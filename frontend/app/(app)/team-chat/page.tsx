"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Send, Users, AtSign } from "lucide-react";

interface Member { id: string; full_name: string; role: string; }
interface Message {
  id: string;
  user_id: string;
  sender_name: string;
  content: string;
  mentions: string[];
  created_at: string;
}

function renderContent(content: string) {
  const parts = content.split(/(@\w[\w\s]*?\b)/g);
  return parts.map((part, i) =>
    part.startsWith("@") ? (
      <span key={i} className="font-semibold rounded px-0.5"
        style={{ color: "var(--accent-purple)", background: "rgba(124,58,237,0.12)" }}>
        {part}
      </span>
    ) : part
  );
}

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + " " +
    d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export default function TeamChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  // @mention state
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionStart, setMentionStart] = useState(0);
  const [mentionIndex, setMentionIndex] = useState(0);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      if (data.user) setCurrentUserId(data.user.id);
    });
    fetch("/api/members").then((r) => r.json()).then((d) => Array.isArray(d) && setMembers(d));
    fetch("/api/team-chat?limit=60").then((r) => r.json()).then((d) => Array.isArray(d) && setMessages(d));
  }, []);

  // Realtime subscription
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("team_messages")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "team_messages" },
        (payload) => {
          const msg = payload.new as Message;
          setMessages((prev) => {
            if (prev.find((m) => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Filtered mention list: @all + members matching query
  const mentionList: Array<{ id: string; name: string }> = mentionQuery !== null
    ? [
        { id: "all", name: "all" },
        ...members.map((m) => ({ id: m.id, name: m.full_name ?? m.id })),
      ].filter((m) => m.name.toLowerCase().includes(mentionQuery.toLowerCase()))
    : [];

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setInput(val);

    const caret = e.target.selectionStart ?? val.length;
    const before = val.slice(0, caret);
    const match = before.match(/@(\w*)$/);
    if (match) {
      setMentionQuery(match[1]);
      setMentionStart(caret - match[0].length);
      setMentionIndex(0);
    } else {
      setMentionQuery(null);
    }
  }

  function pickMention(name: string) {
    const before = input.slice(0, mentionStart);
    const after = input.slice(inputRef.current?.selectionStart ?? input.length);
    const newVal = `${before}@${name} ${after}`;
    setInput(newVal);
    setMentionQuery(null);
    setTimeout(() => {
      inputRef.current?.focus();
      const pos = before.length + name.length + 2;
      inputRef.current?.setSelectionRange(pos, pos);
    }, 10);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (mentionQuery !== null && mentionList.length > 0) {
      if (e.key === "ArrowDown") { e.preventDefault(); setMentionIndex((i) => (i + 1) % mentionList.length); return; }
      if (e.key === "ArrowUp")   { e.preventDefault(); setMentionIndex((i) => (i - 1 + mentionList.length) % mentionList.length); return; }
      if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); pickMention(mentionList[mentionIndex].name); return; }
      if (e.key === "Escape")    { setMentionQuery(null); return; }
    }
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  }

  const extractMentions = useCallback((text: string): string[] => {
    const re = /@(\w+)/g;
    const found: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      if (m[1] === "all") { found.push("all"); continue; }
      const member = members.find((x) => x.full_name?.toLowerCase() === m![1].toLowerCase());
      if (member) found.push(member.id);
    }
    return found;
  }, [members]);

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setInput("");
    setMentionQuery(null);
    const mentions = extractMentions(text);
    await fetch("/api/team-chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: text, mentions }),
    });
    setSending(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  // Group consecutive messages by same sender
  type Group = { sender_name: string; user_id: string; created_at: string; msgs: Message[] };
  const groups: Group[] = [];
  for (const msg of messages) {
    const last = groups[groups.length - 1];
    if (last && last.user_id === msg.user_id &&
        new Date(msg.created_at).getTime() - new Date(last.msgs[last.msgs.length - 1].created_at).getTime() < 5 * 60 * 1000) {
      last.msgs.push(msg);
    } else {
      groups.push({ sender_name: msg.sender_name, user_id: msg.user_id, created_at: msg.created_at, msgs: [msg] });
    }
  }

  return (
    <div className="flex flex-col h-full">

      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3.5 border-b shrink-0"
        style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: "rgba(124,58,237,0.15)" }}>
          <Users size={16} style={{ color: "var(--accent-purple)" }} />
        </div>
        <div>
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Team Chat</p>
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            {members.length} member{members.length !== 1 ? "s" : ""} · Type @ to mention someone
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3"
              style={{ background: "rgba(124,58,237,0.1)" }}>
              <Users size={26} style={{ color: "var(--accent-purple)" }} />
            </div>
            <p className="text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>No messages yet</p>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              Start the conversation. Use @all or @name to mention someone.
            </p>
          </div>
        )}

        {groups.map((group, gi) => {
          const isMe = group.user_id === currentUserId;
          const initials = group.sender_name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
          return (
            <div key={gi} className={`flex gap-3 ${isMe ? "flex-row-reverse" : ""}`}>
              {/* Avatar */}
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 mt-0.5"
                style={{ background: isMe ? "var(--accent-purple)" : "#475569" }}>
                {initials}
              </div>

              <div className={`flex flex-col gap-1 max-w-[70%] ${isMe ? "items-end" : "items-start"}`}>
                {/* Name + time */}
                <div className={`flex items-baseline gap-2 ${isMe ? "flex-row-reverse" : ""}`}>
                  <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
                    {isMe ? "You" : group.sender_name}
                  </span>
                  <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                    {formatTime(group.created_at)}
                  </span>
                </div>

                {/* Bubbles */}
                {group.msgs.map((msg) => (
                  <div key={msg.id}
                    className="px-3.5 py-2 text-sm leading-relaxed break-words"
                    style={{
                      background: isMe ? "var(--accent-purple)" : "var(--bg-secondary)",
                      color: isMe ? "white" : "var(--text-primary)",
                      borderRadius: isMe ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                      border: isMe ? "none" : "1px solid var(--border)",
                    }}>
                    {renderContent(msg.content)}
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="px-5 pb-5 pt-2 shrink-0 relative">
        {/* @mention dropdown */}
        {mentionQuery !== null && mentionList.length > 0 && (
          <div className="absolute bottom-full left-5 right-5 mb-2 rounded-xl border shadow-xl overflow-hidden z-50"
            style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
            <div className="px-3 py-1.5 border-b flex items-center gap-1.5"
              style={{ borderColor: "var(--border)" }}>
              <AtSign size={11} style={{ color: "var(--accent-purple)" }} />
              <span className="text-xs" style={{ color: "var(--text-secondary)" }}>Mention a member</span>
            </div>
            {mentionList.map((m, i) => (
              <button key={m.id} onMouseDown={(e) => { e.preventDefault(); pickMention(m.name); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-white/5 transition-colors"
                style={{
                  background: i === mentionIndex ? "rgba(124,58,237,0.1)" : "transparent",
                  color: i === mentionIndex ? "var(--accent-purple)" : "var(--text-primary)",
                }}>
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                  style={{ background: m.id === "all" ? "#22c55e" : "var(--accent-purple)" }}>
                  {m.id === "all" ? "#" : m.name[0]?.toUpperCase()}
                </div>
                <span>@{m.name}</span>
                {m.id === "all" && (
                  <span className="text-xs ml-auto" style={{ color: "var(--text-secondary)" }}>everyone</span>
                )}
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-3 items-end">
          <div className="flex-1 relative">
            <input
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Message the team… type @ to mention"
              className="w-full px-4 py-3 rounded-xl text-sm outline-none pr-10"
              style={{
                background: "var(--bg-secondary)",
                color: "var(--text-primary)",
                border: "1px solid var(--border)",
              }}
              onFocus={(e) => (e.target.style.borderColor = "var(--accent-purple)")}
              onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
            />
            <AtSign size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: "var(--text-secondary)", opacity: 0.4 }} />
          </div>
          <button onClick={send} disabled={!input.trim() || sending}
            className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-opacity hover:opacity-90 disabled:opacity-40"
            style={{ background: "var(--accent-purple)" }}>
            <Send size={16} className="text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}
