"use client";
import { useState, useRef, useEffect } from "react";
import { Bot, X, Send, Minimize2, Loader2, ChevronRight } from "lucide-react";
import Link from "next/link";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const OPENER = "Hey! 👋 I'm the WorkBox Assistant. Are you looking for a better way to manage your work, or just exploring what WorkBox can do?";

// Hardcoded black/white palette — landing page uses --accent-purple: #fff which
// makes CSS-variable-based buttons invisible (white text on white background).
const C = {
  bg:           "#0a0a0a",
  bgPanel:      "#0d0d0d",
  bgUser:       "#ffffff",
  bgAssistant:  "#161616",
  border:       "#1e1e1e",
  textPrimary:  "#f0f0f0",
  textSecondary:"#606060",
  btnBg:        "#ffffff",
  btnText:      "#000000",
  inputBg:      "#111111",
  inputBorder:  "#222222",
  inputFocus:   "#444444",
};

export default function PublicChatWidget() {
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: OPENER },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSignupCta, setShowSignupCta] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && !minimized) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open, minimized]);

  useEffect(() => {
    if (open && !minimized) inputRef.current?.focus();
  }, [open, minimized]);

  useEffect(() => {
    if (messages.filter((m) => m.role === "user").length >= 2) setShowSignupCta(true);
  }, [messages]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    const next: Message[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setLoading(true);
    try {
      const res = await fetch("/api/ai/public", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next.map((m) => ({ role: m.role, content: m.content })) }),
      });
      const data = await res.json();
      setMessages((prev) => [...prev, { role: "assistant", content: data.content || "Sorry, something went wrong. Try refreshing." }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Couldn't connect right now. Try again in a moment." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 flex items-center gap-2 pl-4 pr-5 h-12 rounded-full shadow-2xl z-50 transition-all hover:scale-105 hover:shadow-white/10"
          style={{ background: C.btnBg, color: C.btnText, boxShadow: "0 4px 24px rgba(255,255,255,0.08), 0 1px 3px rgba(0,0,0,0.6)" }}
        >
          <Bot size={17} style={{ color: C.btnText }} />
          <span className="text-sm font-semibold" style={{ color: C.btnText }}>Chat with us</span>
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div
          className="fixed bottom-6 right-6 z-50 flex flex-col rounded-2xl overflow-hidden"
          style={{
            width: 360,
            height: minimized ? 52 : 520,
            background: C.bg,
            border: `1px solid ${C.border}`,
            boxShadow: "0 24px 80px rgba(0,0,0,0.9), 0 0 0 1px rgba(255,255,255,0.04)",
            transition: "height 0.2s ease",
          }}
        >
          {/* Header */}
          <div
            className="flex items-center gap-2.5 px-4 py-3 border-b flex-shrink-0"
            style={{ borderColor: C.border, background: C.bgPanel }}
          >
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: C.btnBg }}
            >
              <Bot size={14} style={{ color: C.btnText }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold" style={{ color: C.textPrimary }}>WorkBox Assistant</p>
              <p className="text-xs" style={{ color: C.textSecondary }}>Here to help you get started</p>
            </div>
            <button
              onClick={() => setMinimized((m) => !m)}
              className="p-1 rounded hover:bg-white/5 transition-colors"
              style={{ color: C.textSecondary }}
            >
              <Minimize2 size={13} />
            </button>
            <button
              onClick={() => setOpen(false)}
              className="p-1 rounded hover:bg-white/5 transition-colors"
              style={{ color: C.textSecondary }}
            >
              <X size={13} />
            </button>
          </div>

          {!minimized && (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div
                      className="max-w-[82%] px-3 py-2 text-sm leading-relaxed"
                      style={{
                        background: msg.role === "user" ? C.bgUser : C.bgAssistant,
                        color: msg.role === "user" ? "#000" : C.textPrimary,
                        borderRadius: msg.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                        border: msg.role === "assistant" ? `1px solid ${C.border}` : "none",
                      }}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))}

                {loading && (
                  <div className="flex justify-start">
                    <div
                      className="px-3 py-2"
                      style={{ background: C.bgAssistant, border: `1px solid ${C.border}`, borderRadius: "16px 16px 16px 4px" }}
                    >
                      <Loader2 size={14} className="animate-spin" style={{ color: C.textSecondary }} />
                    </div>
                  </div>
                )}

                {showSignupCta && !loading && (
                  <div className="flex justify-start">
                    <Link
                      href="/signup"
                      className="flex items-center gap-2 px-3 py-2 text-sm font-semibold transition-opacity hover:opacity-80"
                      style={{
                        background: C.btnBg,
                        color: C.btnText,
                        borderRadius: "16px 16px 16px 4px",
                      }}
                    >
                      <span>Create your free account</span>
                      <ChevronRight size={13} />
                    </Link>
                  </div>
                )}

                <div ref={bottomRef} />
              </div>

              {/* Input */}
              <div className="p-3 border-t flex gap-2 flex-shrink-0" style={{ borderColor: C.border }}>
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
                  placeholder="Tell me about your workflow…"
                  className="flex-1 text-sm px-3 py-2 rounded-xl outline-none border transition-colors"
                  style={{
                    background: C.inputBg,
                    borderColor: C.inputBorder,
                    color: C.textPrimary,
                  }}
                  onFocus={(e) => (e.target.style.borderColor = C.inputFocus)}
                  onBlur={(e) => (e.target.style.borderColor = C.inputBorder)}
                />
                <button
                  onClick={send}
                  disabled={!input.trim() || loading}
                  className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-opacity hover:opacity-80 disabled:opacity-30"
                  style={{ background: C.btnBg }}
                >
                  <Send size={14} style={{ color: C.btnText }} />
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
