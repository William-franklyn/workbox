"use client";
import { useState, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Bot, X, Send, Minimize2, ChevronDown, ChevronUp, Loader2, Zap, Maximize2 } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
  agent?: boolean;
}

const PAGE_CTX: Record<string, string> = {
  "/tasks":       "Tasks",
  "/forms":       "Forms",
  "/knowledge":   "Knowledge Base",
  "/crm":         "CRM",
  "/hr":          "People & HR",
  "/documents":   "Documents",
  "/budget":      "Budget",
  "/goals":       "Goals",
  "/meetings":    "Meetings",
  "/team-chat":   "Team Chat",
  "/workload":    "Workload",
  "/portfolio":   "Portfolio",
  "/automations": "Automations",
  "/timesheets":  "Timesheets",
  "/templates":   "Templates",
  "/integrations":"Integrations",
  "/settings":    "Settings",
  "/activity":    "Activity",
  "/guests":      "Guests",
  "/chat":        "AI Agent",
};

const PAGE_HINTS: Record<string, string> = {
  "/tasks":     "Create tasks, update status, check what's due…",
  "/forms":     "Create a form, list forms, get share link…",
  "/knowledge": "Find articles, create knowledge entries…",
  "/crm":       "Add contacts, update deals, check pipeline…",
  "/hr":        "Manage employees, approve leave requests…",
  "/documents": "Find or create documents…",
  "/budget":    "Check budgets, add line items…",
  "/goals":     "View goals, update key results…",
  "/meetings":  "Schedule a meeting, list upcoming…",
  "/team-chat": "Send messages, check mentions…",
};

export default function AIAssistant() {
  const pathname = usePathname();
  const isHome = pathname === "/home" || pathname === "/";
  const isChat = pathname.startsWith("/chat");

  const ctxKey  = Object.keys(PAGE_CTX).find(k => pathname.startsWith(k));
  const ctxLabel = ctxKey ? PAGE_CTX[ctxKey] : null;
  const ctxHint  = (ctxKey && PAGE_HINTS[ctxKey]) || "Ask WorkBox Agent anything…";

  // Home state
  const [homeOpen,      setHomeOpen]      = useState(false);
  const [homeMinimized, setHomeMinimized] = useState(false);

  // Non-home state
  const [expanded, setExpanded] = useState(false);

  // Shared state
  const [messages, setMessages] = useState<Message[]>([]);
  const [input,    setInput]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (expanded || (homeOpen && !homeMinimized)) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, expanded, homeOpen, homeMinimized]);

  useEffect(() => {
    if (expanded || (homeOpen && !homeMinimized)) inputRef.current?.focus();
  }, [expanded, homeOpen, homeMinimized]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");

    const userMsg: Message = { role: "user", content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setLoading(true);
    if (!isHome) setExpanded(true);

    const apiMsgs = next.map(m => ({ role: m.role, content: m.content }));

    // Inject page context silently as the first exchange on the first message
    const contextedMsgs = (ctxLabel && messages.length === 0)
      ? [
          { role: "user"      as const, content: `[Context: I am currently on the ${ctxLabel} page in WorkBox]` },
          { role: "assistant" as const, content: `Understood, I'm focused on ${ctxLabel}. Ready to help.` },
          ...apiMsgs,
        ]
      : apiMsgs;

    try {
      if (isHome) {
        // Home: two-tier — support bot → agent escalation
        const sup = await fetch("/api/ai/support", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: apiMsgs }),
        });
        const supData = await sup.json();

        if (supData.escalate) {
          setMessages(prev => [...prev, {
            role: "assistant",
            content: `Handing this off to WorkBox Agent — ${supData.reason}`,
          }]);
          const agentRes = await fetch("/api/ai/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messages: apiMsgs }),
          });
          const agentData = await agentRes.json();
          setMessages(prev => [...prev, {
            role: "assistant",
            content: agentData.content || "Sorry, something went wrong.",
            agent: true,
          }]);
        } else {
          setMessages(prev => [...prev, {
            role: "assistant",
            content: supData.content || supData.error || "Sorry, something went wrong.",
          }]);
        }
      } else {
        // All other pages: go straight to the full agent, no gatekeeping
        const agentRes = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: contextedMsgs }),
        });
        const agentData = await agentRes.json();
        setMessages(prev => [...prev, {
          role: "assistant",
          content: agentData.content || "Sorry, something went wrong.",
          agent: true,
        }]);
      }
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Failed to connect. Please try again." }]);
    } finally {
      setLoading(false);
    }
  }

  // ─── Message bubbles (shared) ──────────────────────────────────────────────
  function renderMessages() {
    return (
      <>
        {messages.map((msg, i) => (
          <div key={i} className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
            {msg.agent && (
              <div className="flex items-center gap-1 mb-1 px-1">
                <Zap size={10} style={{ color: "var(--accent-purple)" }} />
                <span className="text-xs font-medium" style={{ color: "var(--accent-purple)" }}>WorkBox Agent</span>
              </div>
            )}
            <div
              className="max-w-[82%] px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap"
              style={{
                background: msg.role === "user"
                  ? "var(--accent-purple)"
                  : msg.agent
                  ? "rgba(124,58,237,0.1)"
                  : "var(--bg-primary)",
                color:  msg.role === "user" ? "white" : "var(--text-primary)",
                borderRadius: msg.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                border: msg.agent ? "1px solid rgba(124,58,237,0.25)" : "none",
              }}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="px-3 py-2 rounded-2xl flex items-center gap-2"
              style={{ background: "var(--bg-primary)", borderRadius: "16px 16px 16px 4px" }}>
              <Loader2 size={14} className="animate-spin" style={{ color: "var(--text-secondary)" }} />
              <span className="text-xs" style={{ color: "var(--text-secondary)" }}>Working…</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </>
    );
  }

  // ─── Input bar (shared) ────────────────────────────────────────────────────
  function renderInputBar(compact = false) {
    return (
      <div className={`flex items-center gap-2 ${compact ? "px-3 py-2" : "p-3"}`}>
        {compact && (
          <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: "var(--accent-purple)" }}>
            <Bot size={11} className="text-white" />
          </div>
        )}
        {compact && ctxLabel && !expanded && (
          <span className="text-xs px-1.5 py-0.5 rounded-full font-medium flex-shrink-0"
            style={{ background: "rgba(124,58,237,0.15)", color: "var(--accent-purple)" }}>
            {ctxLabel}
          </span>
        )}
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
          onFocus={e => {
            if (!isHome && !expanded && messages.length > 0) setExpanded(true);
            if (!compact) e.target.style.borderColor = "var(--accent-purple)";
          }}
          onBlur={e => { if (!compact) e.target.style.borderColor = "var(--border)"; }}
          placeholder={compact ? ctxHint : "Ask me anything…"}
          className={`flex-1 bg-transparent outline-none min-w-0 ${compact ? "text-xs" : "text-sm px-3 py-2 rounded-xl border"}`}
          style={{
            color: "var(--text-primary)",
            ...(compact ? {} : { borderColor: "var(--border)" }),
          }}
        />
        {compact && messages.length > 0 && !expanded && (
          <button onClick={() => setExpanded(true)}
            className="p-1 rounded hover:bg-white/5 flex-shrink-0"
            style={{ color: "var(--text-secondary)" }}>
            <ChevronUp size={12} />
          </button>
        )}
        <button
          onClick={send}
          disabled={!input.trim() || loading}
          className={`rounded-xl flex items-center justify-center flex-shrink-0 transition-opacity hover:opacity-90 disabled:opacity-40 ${compact ? "w-7 h-7" : "w-9 h-9"}`}
          style={{ background: "var(--accent-purple)" }}
        >
          {loading
            ? <Loader2 size={compact ? 11 : 14} className="text-white animate-spin" />
            : <Send    size={compact ? 11 : 14} className="text-white" />
          }
        </button>
      </div>
    );
  }

  // Chat page already IS the agent — don't render anything
  if (isChat) return null;

  // ─── HOME PAGE — floating button + panel ──────────────────────────────────
  if (isHome) {
    if (!homeOpen) {
      return (
        <button
          onClick={() => { setHomeOpen(true); setMessages([{ role: "assistant", content: "Hi! I'm WorkBox Agent. Ask me to manage tasks, create forms, look up docs, schedule meetings — anything in your workspace." }]); }}
          className="fixed bottom-6 right-6 w-12 h-12 rounded-full flex items-center justify-center shadow-lg z-50 transition-transform hover:scale-110"
          style={{ background: "var(--accent-purple)" }}
        >
          <Bot size={20} className="text-white" />
        </button>
      );
    }

    return (
      <div
        className="fixed bottom-4 right-3 sm:bottom-6 sm:right-6 z-50 flex flex-col rounded-2xl shadow-2xl border overflow-hidden"
        style={{ width: "min(360px, calc(100vw - 1.5rem))", height: homeMinimized ? 52 : 520, background: "var(--bg-secondary)", borderColor: "var(--border)", transition: "height 0.2s ease" }}
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b flex-shrink-0"
          style={{ borderColor: "var(--border)", background: "var(--bg-primary)" }}>
          <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: "var(--accent-purple)" }}>
            <Bot size={14} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>WorkBox Agent</p>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>Your workspace AI</p>
          </div>
          <button onClick={() => setHomeMinimized(m => !m)} className="p-1 rounded hover:bg-white/5" style={{ color: "var(--text-secondary)" }}>
            <Minimize2 size={13} />
          </button>
          <button onClick={() => { setHomeOpen(false); setMessages([]); }} className="p-1 rounded hover:bg-white/5" style={{ color: "var(--text-secondary)" }}>
            <X size={13} />
          </button>
        </div>

        {!homeMinimized && (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {renderMessages()}
            </div>
            <div className="border-t flex-shrink-0" style={{ borderColor: "var(--border)" }}>
              {renderInputBar()}
            </div>
          </>
        )}
      </div>
    );
  }

  // ─── ALL OTHER PAGES — persistent bar + expandable panel ──────────────────
  return (
    <div
      className="fixed bottom-4 right-3 sm:bottom-6 sm:right-6 z-50 flex flex-col rounded-2xl shadow-xl border overflow-hidden"
      style={{
        width: "min(380px, calc(100vw - 1.5rem))",
        background: "var(--bg-secondary)",
        borderColor: expanded ? "rgba(124,58,237,0.4)" : "var(--border)",
        boxShadow: expanded ? "0 8px 40px rgba(0,0,0,0.5)" : "0 4px 20px rgba(0,0,0,0.3)",
        transition: "border-color 0.15s, box-shadow 0.15s",
      }}
    >
      {/* Expanded: header + messages */}
      {expanded && (
        <>
          <div className="flex items-center gap-2 px-4 py-2.5 border-b flex-shrink-0"
            style={{ borderColor: "var(--border)", background: "var(--bg-primary)" }}>
            <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: "var(--accent-purple)" }}>
              <Bot size={12} className="text-white" />
            </div>
            <span className="text-xs font-semibold flex-1 min-w-0" style={{ color: "var(--text-primary)" }}>
              WorkBox Agent
              {ctxLabel && <span className="font-normal ml-1.5 opacity-50">· {ctxLabel}</span>}
            </span>
            <button onClick={() => setExpanded(false)} className="p-1 rounded hover:bg-white/5" style={{ color: "var(--text-secondary)" }}>
              <ChevronDown size={13} />
            </button>
            <button onClick={() => { setExpanded(false); setMessages([]); }} className="p-1 rounded hover:bg-white/5" style={{ color: "var(--text-secondary)" }}>
              <X size={13} />
            </button>
          </div>

          <div className="overflow-y-auto p-4 space-y-3 flex-shrink-0" style={{ maxHeight: 360 }}>
            {renderMessages()}
          </div>

          <div className="border-t flex-shrink-0" style={{ borderColor: "var(--border)" }}>
            {renderInputBar(true)}
          </div>
        </>
      )}

      {/* Always-visible bar when collapsed */}
      {!expanded && renderInputBar(true)}
    </div>
  );
}
