"use client";
import { useEffect, useRef, useState } from "react";
import { Bot, Send, Loader2, Trash2 } from "lucide-react";

interface Message { role: "user" | "assistant"; content: string; }

const SUGGESTIONS = [
  "What tasks do I have this week?",
  "Do I have any messages from the team?",
  "Show me my upcoming meetings",
  "Create a doc summarizing my goals",
];

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    setInput("");
    const next: Message[] = [...messages, { role: "user", content }];
    setMessages(next);
    setLoading(true);
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const data = await res.json();
      setMessages((m) => [...m, { role: "assistant", content: data.content || data.error || "Sorry, something went wrong." }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "Failed to connect. Please try again." }]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0" style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "var(--accent-purple)" }}>
            <Bot size={16} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>WorkBox AI</p>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>Full workspace access · claude-haiku</p>
          </div>
        </div>
        {messages.length > 0 && (
          <button onClick={() => setMessages([])} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors" style={{ color: "var(--text-secondary)" }}>
            <Trash2 size={12} /> Clear chat
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center max-w-lg mx-auto">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: "rgba(124,58,237,0.15)" }}>
              <Bot size={28} style={{ color: "var(--accent-purple)" }} />
            </div>
            <h2 className="text-xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>WorkBox AI</h2>
            <p className="text-sm mb-8" style={{ color: "var(--text-secondary)" }}>
              Your AI brain with full workspace access. Ask me to read, create, or update anything — tasks, docs, messages, meetings, goals, and more.
            </p>
            <div className="grid grid-cols-2 gap-2 w-full">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => send(s)}
                  className="text-left text-xs px-3 py-2.5 rounded-xl border hover:border-purple-500/50 transition-all hover:bg-white/2"
                  style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto space-y-4">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} gap-3`}>
                {msg.role === "assistant" && (
                  <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: "var(--accent-purple)" }}>
                    <Bot size={13} className="text-white" />
                  </div>
                )}
                <div className="max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap"
                  style={{
                    background: msg.role === "user" ? "var(--accent-purple)" : "var(--bg-secondary)",
                    color: msg.role === "user" ? "white" : "var(--text-primary)",
                    borderRadius: msg.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                  }}>
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start gap-3">
                <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "var(--accent-purple)" }}>
                  <Bot size={13} className="text-white" />
                </div>
                <div className="px-4 py-2.5 rounded-2xl flex items-center gap-2" style={{ background: "var(--bg-secondary)", borderRadius: "16px 16px 16px 4px" }}>
                  <Loader2 size={13} className="animate-spin" style={{ color: "var(--text-secondary)" }} />
                  <span className="text-xs" style={{ color: "var(--text-secondary)" }}>Thinking...</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="px-6 pb-6 pt-2 flex-shrink-0">
        <div className="max-w-2xl mx-auto flex gap-3 items-end">
          <input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
            placeholder="Ask me anything about your workspace..."
            className="flex-1 px-4 py-3 rounded-xl text-sm outline-none"
            style={{ background: "var(--bg-secondary)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
            onFocus={(e) => e.target.style.borderColor = "var(--accent-purple)"}
            onBlur={(e) => e.target.style.borderColor = "var(--border)"}
          />
          <button onClick={() => send()} disabled={!input.trim() || loading}
            className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-opacity hover:opacity-90 disabled:opacity-40"
            style={{ background: "var(--accent-purple)" }}>
            <Send size={16} className="text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}
