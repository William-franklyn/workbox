"use client";
import { useState } from "react";
import { Plus, FileText, Trash2 } from "lucide-react";

interface Doc { id: string; title: string; updatedAt: string; }

export default function DocsPage() {
  const [docs, setDocs] = useState<Doc[]>([
    { id: "d1", title: "Getting Started Guide", updatedAt: new Date().toISOString() },
    { id: "d2", title: "Product Roadmap", updatedAt: new Date().toISOString() },
  ]);
  const [activeDoc, setActiveDoc] = useState<Doc | null>(null);

  function createDoc() {
    const doc: Doc = { id: `d${Date.now()}`, title: "Untitled Document", updatedAt: new Date().toISOString() };
    setDocs((d) => [doc, ...d]);
    setActiveDoc(doc);
  }

  function deleteDoc(id: string) {
    setDocs((d) => d.filter((x) => x.id !== id));
    if (activeDoc?.id === id) setActiveDoc(null);
  }

  if (activeDoc) {
    return <DocEditor doc={activeDoc} onBack={() => setActiveDoc(null)} onTitleChange={(title) => {
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
        <button onClick={createDoc}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90"
          style={{ background: "var(--accent-purple)" }}>
          <Plus size={14} /> New doc
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {docs.map((doc) => (
          <div key={doc.id}
            onClick={() => setActiveDoc(doc)}
            className="group p-4 rounded-xl border cursor-pointer hover:border-purple-500/50 transition-all"
            style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
            <div className="flex items-start justify-between">
              <FileText size={18} style={{ color: "var(--accent-purple)" }} />
              <button onClick={(e) => { e.stopPropagation(); deleteDoc(doc.id); }}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-red-500/10"
                style={{ color: "var(--danger)" }}>
                <Trash2 size={13} />
              </button>
            </div>
            <h3 className="font-medium text-sm mt-3 mb-1 truncate" style={{ color: "var(--text-primary)" }}>{doc.title}</h3>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              {new Date(doc.updatedAt).toLocaleDateString()}
            </p>
          </div>
        ))}
        <button onClick={createDoc}
          className="p-4 rounded-xl border-2 border-dashed hover:border-purple-500/50 transition-all flex flex-col items-center justify-center gap-2 min-h-28"
          style={{ borderColor: "var(--border)" }}>
          <Plus size={18} style={{ color: "var(--text-secondary)" }} />
          <span className="text-xs" style={{ color: "var(--text-secondary)" }}>New document</span>
        </button>
      </div>
    </div>
  );
}

type BlockType = "paragraph" | "h1" | "h2" | "h3" | "bullet" | "todo" | "code" | "quote";
interface Block { id: string; type: BlockType; content: string; checked?: boolean; }

function DocEditor({ doc, onBack, onTitleChange }: { doc: Doc; onBack: () => void; onTitleChange: (t: string) => void; }) {
  const [title, setTitle] = useState(doc.title);
  const [blocks, setBlocks] = useState<Block[]>([
    { id: "b1", type: "paragraph", content: "" },
  ]);
  const [focusedId, setFocusedId] = useState<string>("b1");

  function updateBlock(id: string, patch: Partial<Block>) {
    setBlocks((bs) => bs.map((b) => b.id === id ? { ...b, ...patch } : b));
  }

  function addBlock(afterId: string, type: BlockType = "paragraph") {
    const idx = blocks.findIndex((b) => b.id === afterId);
    const nb: Block = { id: `b${Date.now()}`, type, content: "" };
    const next = [...blocks];
    next.splice(idx + 1, 0, nb);
    setBlocks(next);
    setTimeout(() => { const el = document.getElementById(`block-${nb.id}`); el?.focus(); }, 10);
  }

  function removeBlock(id: string) {
    if (blocks.length === 1) return;
    const idx = blocks.findIndex((b) => b.id === id);
    setBlocks((bs) => bs.filter((b) => b.id !== id));
    const prev = blocks[idx - 1];
    if (prev) setTimeout(() => { const el = document.getElementById(`block-${prev.id}`); el?.focus(); }, 10);
  }

  function handleKeyDown(e: React.KeyboardEvent, block: Block) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      addBlock(block.id);
    }
    if (e.key === "Backspace" && block.content === "") {
      e.preventDefault();
      removeBlock(block.id);
    }
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
    if (type === "quote") return { borderLeft: "3px solid var(--accent-purple)", paddingLeft: "12px", fontStyle: "italic", color: "var(--text-secondary)" };
    if (type === "code") return { fontFamily: "monospace", background: "var(--bg-primary)", padding: "4px 8px", borderRadius: "4px", fontSize: "0.85rem", color: "#22c55e" };
    return { color: "var(--text-primary)" };
  }

  const BLOCK_PREFIX: Partial<Record<BlockType, string>> = { bullet: "•  ", todo: "" };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-6 py-3 border-b" style={{ borderColor: "var(--border)" }}>
        <button onClick={onBack} className="text-xs hover:underline" style={{ color: "var(--text-secondary)" }}>← Docs</button>
        <span style={{ color: "var(--border)" }}>/</span>
        <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{title}</span>
        <span className="ml-auto text-xs" style={{ color: "var(--text-secondary)" }}>Tab to cycle block type</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-8 py-12">
          <input value={title}
            onChange={(e) => { setTitle(e.target.value); onTitleChange(e.target.value); }}
            className="w-full text-3xl font-bold bg-transparent outline-none mb-8"
            style={{ color: "var(--text-primary)" }}
            placeholder="Untitled"
          />
          <div className="space-y-1">
            {blocks.map((block) => (
              <div key={block.id} className="flex items-start gap-2 group">
                {block.type === "todo" && (
                  <input type="checkbox" checked={block.checked} onChange={(e) => updateBlock(block.id, { checked: e.target.checked })}
                    className="mt-1 accent-purple-500 flex-shrink-0" />
                )}
                {block.type === "bullet" && (
                  <span className="mt-1.5 flex-shrink-0 text-sm" style={{ color: "var(--accent-purple)" }}>•</span>
                )}
                <div id={`block-${block.id}`}
                  contentEditable suppressContentEditableWarning
                  onFocus={() => setFocusedId(block.id)}
                  onInput={(e) => updateBlock(block.id, { content: (e.target as HTMLElement).innerText })}
                  onKeyDown={(e) => handleKeyDown(e, block)}
                  className="flex-1 outline-none min-h-6 leading-relaxed"
                  style={{ ...blockStyle(block.type), textDecoration: block.type === "todo" && block.checked ? "line-through" : "none", opacity: block.type === "todo" && block.checked ? 0.5 : 1 }}
                  data-placeholder={block.type === "paragraph" ? "Type '/' for commands, Tab to change block type..." : `${block.type}...`}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        [contenteditable]:empty:before { content: attr(data-placeholder); color: var(--text-secondary); opacity: 0.5; pointer-events: none; }
      `}</style>
    </div>
  );
}
