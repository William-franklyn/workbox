"use client";
import { useState, useRef, useEffect } from "react";
import { Bot, X, Send, Minimize2, Loader2, Zap } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
  escalated?: boolean;
}

export default function AIAssistant() {
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Hi! I'm WorkBox Support. Ask me how to use any feature, or ask me to look at your actual workspace and I'll hand you off to the WorkBox Agent." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [escalating, setEscalating] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && !minimized) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open, minimized]);

  useEffect(() => {
    if (open && !minimized) inputRef.current?.focus();
  }, [open, minimized]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");

    const next: Message[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setLoading(true);

    const apiMessages = next.map((m) => ({ role: m.role, content: m.content }));

    try {
      // Tier 1: lightweight support bot
      const supportRes = await fetch("/api/ai/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages }),
      });
      const supportData = await supportRes.json();

      if (supportData.escalate) {
        // Tier 2: escalate to full WorkBox Agent
        setEscalating(true);
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `Handing this off to WorkBox Agent — ${supportData.reason}`, escalated: false },
        ]);

        const agentRes = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: apiMessages }),
        });
        const agentData = await agentRes.json();

        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: agentData.content || "Sorry, something went wrong. Please try again.", escalated: true },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: supportData.content || supportData.error || "Sorry, something went wrong." },
        ]);
      }
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Failed to connect. Please try again." }]);
    } finally {
      setLoading(false);
      setEscalating(false);
    }
  }

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 w-12 h-12 rounded-full flex items-center justify-center shadow-lg z-50 transition-transform hover:scale-110"
          style={{ background: "var(--accent-purple)" }}
        >
          <Bot size={20} className="text-white" />
        </button>
      )}

      {open && (
        <div
          className="fixed bottom-6 right-6 z-50 flex flex-col rounded-2xl shadow-2xl border overflow-hidden"
          style={{ width: 360, height: minimized ? 52 : 520, background: "var(--bg-secondary)", borderColor: "var(--border)", transition: "height 0.2s ease" }}
        >
          {/* Header */}
          <div className="flex items-center gap-2 px-4 py-3 border-b flex-shrink-0" style={{ borderColor: "var(--border)", background: "var(--bg-primary)" }}>
            <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: "var(--accent-purple)" }}>
              <Bot size={14} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>WorkBox Support</p>
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                {escalating ? "Connecting to WorkBox Agent…" : "Ask me anything about WorkBox"}
              </p>
            </div>
            <button onClick={() => setMinimized((m) => !m)} className="p-1 rounded hover:bg-white/5" style={{ color: "var(--text-secondary)" }}>
              <Minimize2 size={13} />
            </button>
            <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-white/5" style={{ color: "var(--text-secondary)" }}>
              <X size={13} />
            </button>
          </div>

          {!minimized && (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map((msg, i) => (
                  <div key={i} className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
                    {msg.escalated && (
                      <div className="flex items-center gap-1 mb-1 px-1">
                        <Zap size={10} style={{ color: "var(--accent-purple)" }} />
                        <span className="text-xs font-medium" style={{ color: "var(--accent-purple)" }}>WorkBox Agent</span>
                      </div>
                    )}
                    <div
                      className="max-w-[80%] px-3 py-2 rounded-2xl text-sm leading-relaxed"
                      style={{
                        background: msg.role === "user"
                          ? "var(--accent-purple)"
                          : msg.escalated
                          ? "rgba(124,58,237,0.12)"
                          : "var(--bg-primary)",
                        color: msg.role === "user" ? "white" : "var(--text-primary)",
                        borderRadius: msg.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                        border: msg.escalated ? "1px solid rgba(124,58,237,0.3)" : "none",
                      }}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex justify-start">
                    <div className="px-3 py-2 rounded-2xl flex items-center gap-2" style={{ background: "var(--bg-primary)", borderRadius: "16px 16px 16px 4px" }}>
                      <Loader2 size={14} className="animate-spin" style={{ color: "var(--text-secondary)" }} />
                      {escalating && <span className="text-xs" style={{ color: "var(--text-secondary)" }}>WorkBox Agent thinking…</span>}
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

              {/* Input */}
              <div className="p-3 border-t flex gap-2 flex-shrink-0" style={{ borderColor: "var(--border)" }}>
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
                  placeholder="Ask me anything…"
                  className="flex-1 text-sm px-3 py-2 rounded-xl bg-transparent outline-none border"
                  style={{ color: "var(--text-primary)", borderColor: "var(--border)" }}
                  onFocus={(e) => (e.target.style.borderColor = "var(--accent-purple)")}
                  onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
                />
                <button
                  onClick={send}
                  disabled={!input.trim() || loading}
                  className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-opacity hover:opacity-90 disabled:opacity-40"
                  style={{ background: "var(--accent-purple)" }}
                >
                  <Send size={14} className="text-white" />
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
