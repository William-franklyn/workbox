"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useWorkspaceStore } from "@/store/workspace";
import { useTasksStore } from "@/store/tasks";
import { Search, ArrowRight, List, MessageSquare, LayoutDashboard, Target, CheckSquare, FileText, BarChart2, Zap, Settings, Building2, User, Table, BookOpen } from "lucide-react";
import type { SearchResult } from "@/app/api/search/route";

interface Result { id: string; label: string; sub?: string; icon: React.ReactNode; action: () => void; }

const SERVER_TYPE_META: Record<SearchResult["type"], { sub: string; icon: React.ReactNode }> = {
  task:        { sub: "Task",        icon: <CheckSquare size={15} /> },
  doc:         { sub: "Doc",         icon: <FileText size={15} /> },
  kb_article:  { sub: "Knowledge",   icon: <BookOpen size={15} /> },
  document:    { sub: "Document",    icon: <FileText size={15} /> },
  crm_company: { sub: "Company",     icon: <Building2 size={15} /> },
  crm_contact: { sub: "Contact",     icon: <User size={15} /> },
  goal:        { sub: "Goal",        icon: <Target size={15} /> },
  spreadsheet: { sub: "Spreadsheet", icon: <Table size={15} /> },
};

export default function CommandPalette({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [serverResults, setServerResults] = useState<SearchResult[]>([]);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const { spaces, setActiveList } = useWorkspaceStore();
  const { tasks } = useTasksStore();

  useEffect(() => { inputRef.current?.focus(); }, []);

  const nav = (href: string) => { router.push(href); onClose(); };

  // Debounced org-wide search (tasks, docs, CRM, knowledge, …) via Postgres FTS
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setServerResults([]); return; }
    const t = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(q)}`)
        .then(r => r.ok ? r.json() : { results: [] })
        .then(({ results }: { results: SearchResult[] }) => setServerResults(results ?? []))
        .catch(() => {});
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  const staticItems: Result[] = [
    { id: "home", label: "Home", sub: "Navigate", icon: <LayoutDashboard size={15} />, action: () => nav("/home") },
    { id: "overview", label: "Overview", sub: "Navigate", icon: <BarChart2 size={15} />, action: () => nav("/overview") },
    { id: "chat", label: "AI Chat", sub: "Navigate", icon: <MessageSquare size={15} />, action: () => nav("/chat/new") },
    { id: "goals", label: "Goals", sub: "Navigate", icon: <Target size={15} />, action: () => nav("/goals") },
    { id: "docs", label: "Docs", sub: "Navigate", icon: <FileText size={15} />, action: () => nav("/docs") },
    { id: "automations", label: "Automations", sub: "Navigate", icon: <Zap size={15} />, action: () => nav("/automations") },
    { id: "settings", label: "Settings", sub: "Navigate", icon: <Settings size={15} />, action: () => nav("/settings") },
  ];

  const listItems: Result[] = spaces
    .flatMap((s) => [...s.lists, ...s.folders.flatMap((f) => f.lists)])
    .map((l) => ({
      id: `list-${l.id}`, label: l.name, sub: "List",
      icon: <List size={15} style={{ color: l.color }} />,
      action: () => { setActiveList(l.id); nav(`/tasks/${l.id}`); },
    }));

  const taskItems: Result[] = Object.values(tasks).flat()
    .filter((t) => t.status !== "done")
    .map((t) => ({
      id: `task-${t.id}`, label: t.title, sub: t.status.replace("_", " "),
      icon: <CheckSquare size={15} style={{ color: t.priority === "urgent" ? "#ef4444" : t.priority === "high" ? "#f97316" : "#94a3b8" }} />,
      action: () => { useWorkspaceStore.getState().setSelectedTask(t.id); onClose(); },
    }));

  const serverItems: Result[] = serverResults.map((r) => ({
    id: `srv-${r.type}-${r.id}`,
    label: r.title,
    sub: r.subtitle ?? SERVER_TYPE_META[r.type].sub,
    icon: SERVER_TYPE_META[r.type].icon,
    action: () => nav(r.href),
  }));

  const all = [...staticItems, ...listItems, ...taskItems];
  const localMatches = query.trim()
    ? all.filter((r) => r.label.toLowerCase().includes(query.toLowerCase()))
    : all.slice(0, 12);

  // Merge, de-duping server tasks already shown from local state
  const localIds = new Set(localMatches.map(r => r.id));
  const results = [
    ...localMatches,
    ...serverItems.filter(r => !localIds.has(r.id.replace(/^srv-task-/, "task-"))),
  ].slice(0, 20);

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
      if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
      if (e.key === "Enter") results[active]?.action();
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [active, results]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24" style={{ background: "rgba(0,0,0,0.7)" }} onClick={onClose}>
      <div className="w-full max-w-xl rounded-xl overflow-hidden shadow-2xl"
        style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
          <Search size={16} style={{ color: "var(--text-secondary)" }} />
          <input ref={inputRef} value={query} onChange={(e) => { setQuery(e.target.value); setActive(0); }}
            placeholder="Search tasks, lists, actions..."
            className="flex-1 bg-transparent outline-none text-sm" style={{ color: "var(--text-primary)" }} />
          {query && <button onClick={() => setQuery("")} className="text-xs px-1.5 rounded hover:bg-white/10" style={{ color: "var(--text-secondary)" }}>✕</button>}
          <kbd className="text-xs px-1.5 py-0.5 rounded" style={{ background: "var(--border)", color: "var(--text-secondary)" }}>ESC</kbd>
        </div>

        <div className="max-h-80 overflow-y-auto py-1">
          {results.length === 0 ? (
            <p className="px-4 py-6 text-sm text-center" style={{ color: "var(--text-secondary)" }}>No results for "{query}"</p>
          ) : results.map((r, i) => (
            <button key={r.id} onClick={r.action} onMouseEnter={() => setActive(i)}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors"
              style={{ background: i === active ? "rgba(124,58,237,0.15)" : "transparent", color: "var(--text-primary)" }}>
              <span style={{ color: "var(--text-secondary)" }}>{r.icon}</span>
              <span className="flex-1 truncate">{r.label}</span>
              {r.sub && <span className="text-xs capitalize" style={{ color: "var(--text-secondary)" }}>{r.sub}</span>}
              {i === active && <ArrowRight size={13} style={{ color: "var(--text-secondary)" }} />}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4 px-4 py-2 border-t text-xs" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
          <span>↑↓ navigate</span><span>↵ open</span><span>ESC close</span>
          <span className="ml-auto">{results.length} result{results.length !== 1 ? "s" : ""}</span>
        </div>
      </div>
    </div>
  );
}
