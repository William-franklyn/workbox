"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useWorkspaceStore } from "@/store/workspace";
import { Search, ArrowRight, List, MessageSquare, LayoutDashboard, Target } from "lucide-react";

interface Result { id: string; label: string; sub?: string; icon: React.ReactNode; action: () => void; }

export default function CommandPalette({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const { spaces } = useWorkspaceStore();

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowDown") setActive((a) => Math.min(a + 1, results.length - 1));
      if (e.key === "ArrowUp") setActive((a) => Math.max(a - 1, 0));
      if (e.key === "Enter") results[active]?.action();
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [active, query]);

  const staticItems: Result[] = [
    { id: "home", label: "Go to Home", icon: <LayoutDashboard size={15} />, action: () => { router.push("/home"); onClose(); } },
    { id: "chat", label: "Open Chat", icon: <MessageSquare size={15} />, action: () => { router.push("/chat/new"); onClose(); } },
    { id: "goals", label: "View Goals", icon: <Target size={15} />, action: () => { router.push("/goals"); onClose(); } },
  ];

  const listItems: Result[] = spaces
    .flatMap((s) => [...s.lists, ...s.folders.flatMap((f) => f.lists)])
    .map((l) => ({
      id: l.id,
      label: l.name,
      sub: "List",
      icon: <List size={15} style={{ color: l.color }} />,
      action: () => { router.push(`/tasks/${l.id}`); onClose(); },
    }));

  const all = [...staticItems, ...listItems];
  const results = query
    ? all.filter((r) => r.label.toLowerCase().includes(query.toLowerCase()))
    : all;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24" style={{ background: "rgba(0,0,0,0.7)" }} onClick={onClose}>
      <div
        className="w-full max-w-xl rounded-xl overflow-hidden shadow-2xl"
        style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
          <Search size={16} style={{ color: "var(--text-secondary)" }} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActive(0); }}
            placeholder="Search tasks, spaces, actions..."
            className="flex-1 bg-transparent outline-none text-sm"
            style={{ color: "var(--text-primary)" }}
          />
          <kbd className="text-xs px-1.5 py-0.5 rounded" style={{ background: "var(--border)", color: "var(--text-secondary)" }}>ESC</kbd>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto py-1">
          {results.length === 0 && (
            <p className="px-4 py-6 text-sm text-center" style={{ color: "var(--text-secondary)" }}>No results for "{query}"</p>
          )}
          {results.map((r, i) => (
            <button
              key={r.id}
              onClick={r.action}
              onMouseEnter={() => setActive(i)}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors"
              style={{
                background: i === active ? "rgba(124,58,237,0.15)" : "transparent",
                color: "var(--text-primary)",
              }}
            >
              <span style={{ color: "var(--text-secondary)" }}>{r.icon}</span>
              <span className="flex-1">{r.label}</span>
              {r.sub && <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{r.sub}</span>}
              {i === active && <ArrowRight size={13} style={{ color: "var(--text-secondary)" }} />}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4 px-4 py-2 border-t text-xs" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
          <span>↑↓ navigate</span><span>↵ select</span><span>ESC close</span>
        </div>
      </div>
    </div>
  );
}
