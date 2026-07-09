"use client";
import { useState, useRef, useEffect } from "react";
import { Bot, X, Send, Minimize2, Loader2, ChevronRight, Sparkles } from "lucide-react";
import Link from "next/link";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const OPENER = "Hey! 👋 I'm the WorkBox Assistant. Are you looking for a better way to manage your work, or just exploring what WorkBox can do?";

// The landing page is pure black, so the widget carries its own identity:
// a purple-gradient accent that stands out instead of blending in.
const GRADIENT = "linear-gradient(135deg, #7c3aed 0%, #a855f7 55%, #6366f1 100%)";
const C = {
  panelBg:      "#12121a",
  panelBorder:  "rgba(139,92,246,0.35)",
  headerText:   "#ffffff",
  bgAssistant:  "#1d1d28",
  border:       "#2a2a38",
  textPrimary:  "#f2f2f7",
  textSecondary:"#9a9aad",
  inputBg:      "#181822",
  inputBorder:  "#2e2e3e",
  inputFocus:   "#8b5cf6",
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
          className="fixed bottom-6 right-6 flex items-center gap-2.5 pl-4 pr-5 h-13 rounded-full z-50 transition-all hover:scale-105"
          style={{
            background: GRADIENT,
            color: "#fff",
            padding: "14px 20px 14px 16px",
            boxShadow: "0 8px 32px rgba(124,58,237,0.45), 0 2px 8px rgba(0,0,0,0.5)",
          }}
        >
          <span className="relative flex items-center justify-center">
            <Bot size={18} />
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full border"
              style={{ background: "#22c55e", borderColor: "#12121a" }} />
          </span>
          <span className="text-sm font-semibold">Chat with us</span>
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div
          className="fixed z-50 flex flex-col rounded-2xl overflow-hidden"
          style={{
            bottom: 16,
            right: 16,
            width: "min(380px, calc(100vw - 32px))",
            height: minimized ? 56 : "min(560px, calc(100vh - 96px))",
            background: C.panelBg,
            border: `1px solid ${C.panelBorder}`,
            boxShadow: "0 24px 80px rgba(0,0,0,0.85), 0 0 40px rgba(124,58,237,0.18)",
            transition: "height 0.2s ease",
          }}
        >
          {/* Header — gradient so the widget is unmistakably a chat, not part of the page */}
          <div
            className="flex items-center gap-3 px-4 py-3 flex-shrink-0"
            style={{ background: GRADIENT }}
          >
            <div
              className="relative w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(255,255,255,0.2)", backdropFilter: "blur(4px)" }}
            >
              <Bot size={16} style={{ color: "#fff" }} />
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2"
                style={{ background: "#22c55e", borderColor: "#7c3aed" }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold" style={{ color: C.headerText }}>WorkBox Assistant</p>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.75)" }}>Online — replies instantly</p>
            </div>
            <button
              onClick={() => setMinimized((m) => !m)}
              className="p-1.5 rounded-lg hover:bg-white/15 transition-colors"
              style={{ color: "rgba(255,255,255,0.9)" }}
            >
              <Minimize2 size={14} />
            </button>
            <button
              onClick={() => setOpen(false)}
              className="p-1.5 rounded-lg hover:bg-white/15 transition-colors"
              style={{ color: "rgba(255,255,255,0.9)" }}
            >
              <X size={14} />
            </button>
          </div>

          {!minimized && (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map((msg, i) => (
                  <div key={i} className={`flex items-end gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    {msg.role === "assistant" && (
                      <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mb-0.5"
                        style={{ background: GRADIENT }}>
                        <Sparkles size={11} style={{ color: "#fff" }} />
                      </div>
                    )}
                    <div
                      className="max-w-[80%] px-3.5 py-2.5 text-sm leading-relaxed"
                      style={{
                        background: msg.role === "user" ? GRADIENT : C.bgAssistant,
                        color: msg.role === "user" ? "#fff" : C.textPrimary,
                        borderRadius: msg.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                        border: msg.role === "assistant" ? `1px solid ${C.border}` : "none",
                      }}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))}

                {loading && (
                  <div className="flex items-end gap-2 justify-start">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mb-0.5"
                      style={{ background: GRADIENT }}>
                      <Sparkles size={11} style={{ color: "#fff" }} />
                    </div>
                    <div
                      className="px-3.5 py-2.5"
                      style={{ background: C.bgAssistant, border: `1px solid ${C.border}`, borderRadius: "16px 16px 16px 4px" }}
                    >
                      <Loader2 size={14} className="animate-spin" style={{ color: C.textSecondary }} />
                    </div>
                  </div>
                )}

                {showSignupCta && !loading && (
                  <div className="flex justify-start pl-8">
                    <Link
                      href="/signup"
                      className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-transform hover:scale-[1.02] rounded-xl"
                      style={{
                        background: GRADIENT,
                        color: "#fff",
                        boxShadow: "0 4px 16px rgba(124,58,237,0.35)",
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
              <div className="p-3 border-t flex gap-2 flex-shrink-0" style={{ borderColor: C.border, background: "rgba(255,255,255,0.02)" }}>
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
                  placeholder="Ask anything about WorkBox…"
                  className="flex-1 text-sm px-3.5 py-2.5 rounded-xl outline-none border transition-colors"
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
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform hover:scale-105 disabled:opacity-30 disabled:hover:scale-100"
                  style={{ background: GRADIENT, boxShadow: "0 2px 12px rgba(124,58,237,0.35)" }}
                >
                  <Send size={15} style={{ color: "#fff" }} />
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
