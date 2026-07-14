"use client";
import { useEffect, useMemo, useState } from "react";
import {
  Bookmark as BookmarkIcon, Plus, Trash2, Pencil, X, ExternalLink,
  User, Building2, Briefcase, Sparkles, GraduationCap, Link as LinkIcon, FolderPlus,
} from "lucide-react";

interface Folder { id: string; name: string; color: string; position: number }
interface Mark { id: string; folder_id: string | null; kind: string; title: string; url: string | null; subtitle: string | null; notes: string | null }

const KINDS = [
  { id: "person", label: "Person", icon: User },
  { id: "company", label: "Company", icon: Building2 },
  { id: "job", label: "Job", icon: Briefcase },
  { id: "opportunity", label: "Opportunity", icon: Sparkles },
  { id: "training", label: "Training", icon: GraduationCap },
  { id: "link", label: "Link", icon: LinkIcon },
];
const kindMeta = (k: string) => KINDS.find(x => x.id === k) ?? KINDS[5];
const FOLDER_COLORS = ["#7c3aed", "#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#ec4899", "#06b6d4", "#8b5cf6"];

const empty: Partial<Mark> = { title: "", url: "", kind: "link", subtitle: "", notes: "", folder_id: null };

export default function BookmarksPage() {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [marks, setMarks] = useState<Mark[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<string | "all" | "unfiled">("all");
  const [newFolder, setNewFolder] = useState("");
  const [addingFolder, setAddingFolder] = useState(false);
  const [editor, setEditor] = useState<Partial<Mark> | null>(null); // add/edit modal

  useEffect(() => {
    fetch("/api/bookmarks").then(r => r.json()).then(d => {
      setFolders(d.folders ?? []);
      setMarks(d.bookmarks ?? []);
    }).finally(() => setLoading(false));
  }, []);

  const visible = useMemo(() => {
    if (active === "all") return marks;
    if (active === "unfiled") return marks.filter(m => !m.folder_id);
    return marks.filter(m => m.folder_id === active);
  }, [marks, active]);

  const countFor = (id: string | "all" | "unfiled") =>
    id === "all" ? marks.length : id === "unfiled" ? marks.filter(m => !m.folder_id).length : marks.filter(m => m.folder_id === id).length;

  async function addFolder() {
    const name = newFolder.trim();
    setAddingFolder(false); setNewFolder("");
    if (!name) return;
    const color = FOLDER_COLORS[folders.length % FOLDER_COLORS.length];
    const res = await fetch("/api/bookmarks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "folder", name, color, position: folders.length }) });
    const f = await res.json();
    if (f?.id) setFolders(fs => [...fs, f]);
  }

  async function deleteFolder(id: string) {
    if (!confirm("Delete this folder and its bookmarks?")) return;
    setFolders(fs => fs.filter(f => f.id !== id));
    setMarks(ms => ms.filter(m => m.folder_id !== id));
    if (active === id) setActive("all");
    fetch("/api/bookmarks", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, type: "folder" }) }).catch(() => {});
  }

  async function saveMark() {
    if (!editor) return;
    const isEdit = !!editor.id;
    const payload = { type: "bookmark", ...editor, folder_id: editor.folder_id || (active !== "all" && active !== "unfiled" ? active : null) };
    const res = await fetch("/api/bookmarks", {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const m = await res.json();
    if (m?.id) {
      setMarks(ms => isEdit ? ms.map(x => x.id === m.id ? m : x) : [m, ...ms]);
    }
    setEditor(null);
  }

  async function deleteMark(id: string) {
    setMarks(ms => ms.filter(m => m.id !== id));
    fetch("/api/bookmarks", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, type: "bookmark" }) }).catch(() => {});
  }

  async function moveMark(id: string, folder_id: string | null) {
    setMarks(ms => ms.map(m => m.id === id ? { ...m, folder_id } : m));
    fetch("/api/bookmarks", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, type: "bookmark", folder_id }) }).catch(() => {});
  }

  const activeName = active === "all" ? "All bookmarks" : active === "unfiled" ? "Unfiled" : folders.find(f => f.id === active)?.name ?? "";

  return (
    <div className="flex h-full min-h-0">
      {/* Folders rail */}
      <div className="w-56 shrink-0 border-r overflow-y-auto p-3" style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}>
        <div className="flex items-center gap-2 px-1 mb-3">
          <BookmarkIcon size={16} style={{ color: "var(--accent-purple)" }} />
          <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Bookmarks</span>
        </div>

        {([["all", "All bookmarks"], ["unfiled", "Unfiled"]] as const).map(([id, label]) => (
          <button key={id} onClick={() => setActive(id)}
            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-sm mb-0.5 transition-colors"
            style={{ background: active === id ? "var(--bg-active)" : "transparent", color: active === id ? "#fff" : "var(--text-secondary)", fontWeight: active === id ? 600 : 500 }}>
            <span>{label}</span>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>{countFor(id)}</span>
          </button>
        ))}

        <div className="h-px my-2" style={{ background: "var(--border)" }} />

        {folders.map(f => (
          <div key={f.id} className="group flex items-center rounded-lg" style={{ background: active === f.id ? "var(--bg-active)" : "transparent" }}>
            <button onClick={() => setActive(f.id)} className="flex items-center gap-2 flex-1 min-w-0 px-2.5 py-1.5 text-sm">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: f.color }} />
              <span className="truncate flex-1 text-left" style={{ color: active === f.id ? "#fff" : "var(--text-primary)", fontWeight: active === f.id ? 600 : 500 }}>{f.name}</span>
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>{countFor(f.id)}</span>
            </button>
            <button onClick={() => deleteFolder(f.id)} className="p-1 mr-1 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "var(--danger)" }}>
              <Trash2 size={12} />
            </button>
          </div>
        ))}

        {addingFolder ? (
          <input autoFocus value={newFolder} onChange={e => setNewFolder(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") addFolder(); if (e.key === "Escape") { setAddingFolder(false); setNewFolder(""); } }}
            onBlur={addFolder} placeholder="Folder name…"
            className="w-full mt-1 px-2.5 py-1.5 rounded-lg text-sm outline-none"
            style={{ background: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--accent-purple)" }} />
        ) : (
          <button onClick={() => setAddingFolder(true)} className="w-full flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs mt-1 transition-colors hover:bg-white/5" style={{ color: "var(--text-muted)" }}>
            <FolderPlus size={13} /> New folder
          </button>
        )}
      </div>

      {/* Items */}
      <div className="flex-1 min-w-0 overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{activeName}</h1>
          <button onClick={() => setEditor({ ...empty })} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-white" style={{ background: "var(--accent-purple)" }}>
            <Plus size={15} /> Add bookmark
          </button>
        </div>

        {loading ? (
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Loading…</p>
        ) : visible.length === 0 ? (
          <div className="text-center py-20 rounded-xl border border-dashed" style={{ borderColor: "var(--border-strong)" }}>
            <BookmarkIcon size={26} className="mx-auto mb-2" style={{ color: "var(--text-muted)" }} />
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>No bookmarks here yet.</p>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Add one, or save from the browser extension.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {visible.map(m => {
              const K = kindMeta(m.kind); const Icon = K.icon;
              return (
                <div key={m.id} className="group rounded-xl border p-3.5 flex flex-col gap-1.5 transition-colors" style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
                  <div className="flex items-start gap-2.5">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: "var(--bg-surface)", color: "var(--accent-purple)" }}>
                      <Icon size={15} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{m.title}</p>
                      {m.subtitle && <p className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>{m.subtitle}</p>}
                    </div>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => setEditor(m)} className="p-1 rounded hover:bg-white/10" style={{ color: "var(--text-secondary)" }}><Pencil size={12} /></button>
                      <button onClick={() => deleteMark(m.id)} className="p-1 rounded hover:bg-white/10" style={{ color: "var(--danger)" }}><Trash2 size={12} /></button>
                    </div>
                  </div>
                  {m.notes && <p className="text-xs line-clamp-2" style={{ color: "var(--text-secondary)" }}>{m.notes}</p>}
                  <div className="flex items-center justify-between mt-1">
                    {m.url ? (
                      <a href={m.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs hover:underline truncate max-w-[65%]" style={{ color: "var(--accent-purple)" }}>
                        <ExternalLink size={11} className="shrink-0" /> <span className="truncate">Open</span>
                      </a>
                    ) : <span className="text-xs capitalize" style={{ color: "var(--text-muted)" }}>{K.label}</span>}
                    <select value={m.folder_id ?? ""} onChange={e => moveMark(m.id, e.target.value || null)}
                      className="text-xs rounded-md px-1.5 py-0.5 outline-none" style={{ background: "var(--bg-primary)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
                      <option value="">Unfiled</option>
                      {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add / edit modal */}
      {editor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }} onClick={() => setEditor(null)}>
          <div className="w-full max-w-md rounded-2xl border p-5" style={{ background: "var(--bg-elevated)", borderColor: "var(--border-strong)" }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{editor.id ? "Edit bookmark" : "Add bookmark"}</h2>
              <button onClick={() => setEditor(null)} style={{ color: "var(--text-secondary)" }}><X size={16} /></button>
            </div>
            <div className="space-y-3">
              <input autoFocus value={editor.title ?? ""} onChange={e => setEditor({ ...editor, title: e.target.value })} placeholder="Title (name, role, company…)"
                className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }} />
              <input value={editor.url ?? ""} onChange={e => setEditor({ ...editor, url: e.target.value })} placeholder="URL (optional)"
                className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }} />
              <input value={editor.subtitle ?? ""} onChange={e => setEditor({ ...editor, subtitle: e.target.value })} placeholder="Subtitle — role / company (optional)"
                className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }} />
              <div className="flex gap-2">
                <select value={editor.kind ?? "link"} onChange={e => setEditor({ ...editor, kind: e.target.value })}
                  className="flex-1 px-3 py-2 rounded-lg text-sm outline-none" style={{ background: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }}>
                  {KINDS.map(k => <option key={k.id} value={k.id}>{k.label}</option>)}
                </select>
                <select value={editor.folder_id ?? ""} onChange={e => setEditor({ ...editor, folder_id: e.target.value || null })}
                  className="flex-1 px-3 py-2 rounded-lg text-sm outline-none" style={{ background: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }}>
                  <option value="">Unfiled</option>
                  {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
              <textarea value={editor.notes ?? ""} onChange={e => setEditor({ ...editor, notes: e.target.value })} placeholder="Notes (optional)" rows={3}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none" style={{ background: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }} />
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setEditor(null)} className="px-3 py-2 rounded-lg text-sm" style={{ color: "var(--text-secondary)" }}>Cancel</button>
              <button onClick={saveMark} disabled={!(editor.title ?? "").trim() && !(editor.url ?? "").trim()} className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50" style={{ background: "var(--accent-purple)" }}>
                {editor.id ? "Save" : "Add"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
