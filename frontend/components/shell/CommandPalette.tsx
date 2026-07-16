"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useWorkspaceStore } from "@/store/workspace";
import { useTasksStore } from "@/store/tasks";
import { Search, ArrowRight, List, CheckSquare, FileText, Target, Building2, User, Table, BookOpen, Brain, Sparkles } from "lucide-react";
import type { SearchResult } from "@/app/api/search/route";
import { NAV_SECTIONS, ADMIN_SECTION } from "./navConfig";

interface Result { id: string; label: string; sub?: string; icon: React.ReactNode; action: () => void; }

/** Chunk match from GET /api/knowledge/search (semantic, permission-aware). */
interface KnowledgeMatch { source_id: string; source_type: string; title: string; similarity: number; }

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

  // Debounced semantic search over the knowledge platform (docs/knowledge-platform.md).
  // Slower + costs an embedding call, so longer debounce and min length than FTS.
  // Silently empty when embeddings aren't configured (route returns 503).
  const [knowledgeMatches, setKnowledgeMatches] = useState<KnowledgeMatch[]>([]);
  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) { setKnowledgeMatches([]); return; }
    const t = setTimeout(() => {
      fetch(`/api/knowledge/search?q=${encodeURIComponent(q)}&k=6`)
        .then(r => r.ok ? r.json() : { results: [] })
        .then(({ results }: { results: KnowledgeMatch[] }) => {
          // Chunks → one entry per source document, best similarity wins
          const bySource = new Map<string, KnowledgeMatch>();
          for (const m of results ?? []) {
            const prev = bySource.get(m.source_id);
            if (!prev || m.similarity > prev.similarity) bySource.set(m.source_id, m);
          }
          setKnowledgeMatches([...bySource.values()].slice(0, 4));
        })
        .catch(() => {});
    }, 400);
    return () => clearTimeout(t);
  }, [query]);

  // Every navigable destination — sections + their nested children + admin —
  // sourced from the shared nav config so the palette never goes stale.
  const staticItems: Result[] = (() => {
    const targets = [
      ...NAV_SECTIONS.flatMap((s) => [{ label: s.label, href: s.href, icon: s.icon }, ...(s.children ?? [])]),
      ...(ADMIN_SECTION.children ?? []),
    ];
    const seen = new Set<string>();
    const items: Result[] = [];
    for (const t of targets) {
      if (seen.has(t.href)) continue;
      seen.add(t.href);
      const Icon = t.icon;
      items.push({ id: `nav-${t.href}`, label: t.label, sub: "Navigate", icon: <Icon size={15} />, action: () => nav(t.href) });
    }
    return items;
  })();

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

  // Semantic hits + the "ask AI" escape hatch, both landing in the Knowledge Hub
  const askHref = `/knowledge-hub?q=${encodeURIComponent(query.trim())}`;
  const askItem: Result | null = query.trim().length >= 3
    ? {
        id: "ask-knowledge",
        label: `Ask: "${query.trim()}"`,
        sub: "AI answer",
        icon: <Sparkles size={15} style={{ color: "var(--accent-purple)" }} />,
        action: () => nav(askHref),
      }
    : null;
  const knowledgeItems: Result[] = knowledgeMatches.map((m) => ({
    id: `knw-${m.source_id}`,
    label: m.title,
    sub: `Knowledge · ${Math.round(m.similarity * 100)}%`,
    icon: <Brain size={15} style={{ color: "var(--accent-purple)" }} />,
    action: () => nav(askHref),
  }));

  const all = [...staticItems, ...listItems, ...taskItems];
  const localMatches = query.trim()
    ? all.filter((r) => r.label.toLowerCase().includes(query.toLowerCase()))
    : all.slice(0, 12);

  // Merge: ask action first, then local, semantic knowledge, FTS —
  // de-duping server tasks already shown from local state
  const localIds = new Set(localMatches.map(r => r.id));
  const results = [
    ...(askItem ? [askItem] : []),
    ...localMatches,
    ...knowledgeItems,
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
            placeholder="Search tasks, docs, knowledge — or ask a question..."
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
