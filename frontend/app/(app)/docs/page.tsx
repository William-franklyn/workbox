"use client";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, FileText, Trash2, Loader2, Search } from "lucide-react";

interface Doc { id: string; title: string; updated_at: string; blocks?: Block[]; }
type BlockType = "paragraph" | "h1" | "h2" | "h3" | "bullet" | "todo" | "code" | "quote";
interface Block { id: string; type: BlockType; content: string; checked?: boolean; }

function newBlock(type: BlockType = "paragraph"): Block {
  return { id: `b${Date.now()}${Math.random()}`, type, content: "" };
}

export default function DocsPage() {
  return (
    <Suspense fallback={null}>
      <DocsPageInner />
    </Suspense>
  );
}

function DocsPageInner() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeDoc, setActiveDoc] = useState<Doc | null>(null);
  const [search, setSearch] = useState("");
  const searchParams = useSearchParams();

  useEffect(() => {
    fetch("/api/docs").then((r) => r.json()).then((d) => { if (Array.isArray(d)) setDocs(d); }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const openId = searchParams.get("open");
    if (!openId) return;
    fetch(`/api/docs/${openId}`).then((r) => r.ok ? r.json() : null).then((full) => {
      if (full) setActiveDoc(full);
    });
  }, [searchParams]);

  async function createDoc() {
    const doc = { id: `d${Date.now()}`, title: "Untitled Document", blocks: [newBlock()] };
    const res = await fetch("/api/docs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(doc) });
    const saved = res.ok ? await res.json() : doc;
    setDocs((d) => [saved, ...d]);
    setActiveDoc({ ...saved, blocks: [newBlock()] });
  }

  async function deleteDoc(id: string) {
    setDocs((d) => d.filter((x) => x.id !== id));
    if (activeDoc?.id === id) setActiveDoc(null);
    await fetch("/api/docs", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
  }

  async function openDoc(doc: Doc) {
    // Fetch full doc with blocks
    const res = await fetch(`/api/docs/${doc.id}`);
    if (res.ok) { const full = await res.json(); setActiveDoc(full); }
    else setActiveDoc({ ...doc, blocks: [newBlock()] });
  }

  if (activeDoc) {
    return <DocEditor doc={activeDoc} onBack={() => setActiveDoc(null)}
      onTitleChange={(title) => {
        setActiveDoc((d) => d ? { ...d, title } : d);
        setDocs((ds) => ds.map((d) => d.id === activeDoc.id ? { ...d, title } : d));
      }} />;
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Docs</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>Create and share documents with your team</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
            <Search size={13} style={{ color: "var(--text-secondary)" }} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search docs..."
              className="bg-transparent outline-none text-sm w-36" style={{ color: "var(--text-primary)" }} />
          </div>
          <button onClick={createDoc} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90" style={{ background: "var(--accent-purple)" }}>
            <Plus size={14} /> New doc
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={20} className="animate-spin" style={{ color: "var(--text-secondary)" }} /></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {docs.filter((d) => !search || d.title.toLowerCase().includes(search.toLowerCase())).map((doc) => (
            <div key={doc.id} onClick={() => openDoc(doc)}
              className="group p-4 rounded-xl border cursor-pointer hover:border-purple-500/50 transition-all"
              style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
              <div className="flex items-start justify-between">
                <FileText size={18} style={{ color: "var(--accent-purple)" }} />
                <button onClick={(e) => { e.stopPropagation(); deleteDoc(doc.id); }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-red-500/10" style={{ color: "var(--danger)" }}>
                  <Trash2 size={13} />
                </button>
              </div>
              <h3 className="font-medium text-sm mt-3 mb-1 truncate" style={{ color: "var(--text-primary)" }}>{doc.title}</h3>
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{new Date(doc.updated_at).toLocaleDateString()}</p>
            </div>
          ))}
          <button onClick={createDoc}
            className="p-4 rounded-xl border-2 border-dashed hover:border-purple-500/50 transition-all flex flex-col items-center justify-center gap-2 min-h-28"
            style={{ borderColor: "var(--border)" }}>
            <Plus size={18} style={{ color: "var(--text-secondary)" }} />
            <span className="text-xs" style={{ color: "var(--text-secondary)" }}>New document</span>
          </button>
        </div>
      )}
    </div>
  );
}

function DocEditor({ doc, onBack, onTitleChange }: { doc: Doc; onBack: () => void; onTitleChange: (t: string) => void }) {
  const [title, setTitle] = useState(doc.title);
  const [blocks, setBlocks] = useState<Block[]>(doc.blocks?.length ? doc.blocks : [newBlock()]);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = useCallback((t: string, bs: Block[]) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      fetch("/api/docs", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: doc.id, title: t, blocks: bs }) });
    }, 800);
  }, [doc.id]);

  function updateTitle(t: string) { setTitle(t); onTitleChange(t); save(t, blocks); }
  function updateBlocks(bs: Block[]) { setBlocks(bs); save(title, bs); }

  function updateBlock(id: string, patch: Partial<Block>) {
    const next = blocks.map((b) => b.id === id ? { ...b, ...patch } : b);
    updateBlocks(next);
  }

  function addBlockAfter(id: string, type: BlockType = "paragraph") {
    const idx = blocks.findIndex((b) => b.id === id);
    const nb = newBlock(type);
    const next = [...blocks];
    next.splice(idx + 1, 0, nb);
    updateBlocks(next);
    setTimeout(() => document.getElementById(`block-${nb.id}`)?.focus(), 20);
  }

  function removeBlock(id: string) {
    if (blocks.length === 1) return;
    const idx = blocks.findIndex((b) => b.id === id);
    const next = blocks.filter((b) => b.id !== id);
    updateBlocks(next);
    setTimeout(() => document.getElementById(`block-${next[Math.max(0, idx - 1)]?.id}`)?.focus(), 20);
  }

  function handleKeyDown(e: React.KeyboardEvent, block: Block) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); addBlockAfter(block.id); }
    if (e.key === "Backspace" && block.content === "") { e.preventDefault(); removeBlock(block.id); }
    if (e.key === "Tab") {
      e.preventDefault();
      const types: BlockType[] = ["paragraph", "bullet", "todo", "h1", "h2", "h3", "quote", "code"];
      const curr = types.indexOf(block.type);
      updateBlock(block.id, { type: types[(curr + 1) % types.length] });
    }
  }

  function blockStyle(type: BlockType): React.CSSProperties {
    if (type === "h1") return { fontSize: "1.75rem", fontWeight: 700, color: "var(--text-primary)" };
    if (type === "h2") return { fontSize: "1.35rem", fontWeight: 600, color: "var(--text-primary)" };
    if (type === "h3") return { fontSize: "1.1rem", fontWeight: 600, color: "var(--text-primary)" };
    if (type === "quote") return { borderLeft: "3px solid var(--accent-purple)", paddingLeft: 12, fontStyle: "italic", color: "var(--text-secondary)" };
    if (type === "code") return { fontFamily: "monospace", background: "var(--bg-primary)", padding: "4px 8px", borderRadius: 4, fontSize: "0.85rem", color: "#22c55e" };
    return { color: "var(--text-primary)" };
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-6 py-3 border-b" style={{ borderColor: "var(--border)" }}>
        <button onClick={onBack} className="text-xs hover:underline" style={{ color: "var(--text-secondary)" }}>← Docs</button>
        <span style={{ color: "var(--border)" }}>/</span>
        <span className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>{title}</span>
        <span className="ml-auto text-xs" style={{ color: "var(--text-secondary)" }}>Auto-saved · Tab to cycle block type</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-8 py-12">
          <input value={title} onChange={(e) => updateTitle(e.target.value)}
            className="w-full text-3xl font-bold bg-transparent outline-none mb-8" style={{ color: "var(--text-primary)" }} placeholder="Untitled" />
          <div className="space-y-1">
            {blocks.map((block) => (
              <div key={block.id} className="flex items-start gap-2">
                {block.type === "todo" && (
                  <input type="checkbox" checked={!!block.checked} onChange={(e) => updateBlock(block.id, { checked: e.target.checked })} className="mt-1 flex-shrink-0" />
                )}
                {block.type === "bullet" && <span className="mt-1.5 flex-shrink-0 text-sm" style={{ color: "var(--accent-purple)" }}>•</span>}
                <div id={`block-${block.id}`} contentEditable suppressContentEditableWarning
                  onInput={(e) => updateBlock(block.id, { content: (e.target as HTMLElement).innerText })}
                  onKeyDown={(e) => handleKeyDown(e, block)}
                  className="flex-1 outline-none min-h-6 leading-relaxed"
                  style={{ ...blockStyle(block.type), textDecoration: block.type === "todo" && block.checked ? "line-through" : "none", opacity: block.type === "todo" && block.checked ? 0.5 : 1 }}
                  data-placeholder={block.type === "paragraph" ? "Type something... (Tab to change block)" : `${block.type}...`}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
      <style>{`[contenteditable]:empty:before{content:attr(data-placeholder);color:var(--text-secondary);opacity:0.4;pointer-events:none}`}</style>
    </div>
  );
}
