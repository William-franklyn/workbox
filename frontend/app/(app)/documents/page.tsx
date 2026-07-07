"use client";
import { useEffect, useState, useCallback } from "react";
import {
  Plus, Search, FolderOpen, FileText, X, Loader2, Trash2,
  Edit3, Tag, Calendar, CheckCircle, Clock, AlertCircle,
  Download, Eye, File, FolderPlus,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface OrgDocument {
  id: string; name: string; description?: string; folder?: string;
  file_type?: string; file_size?: number; status?: string; tags: string[];
  version?: number; author_name?: string; expires_at?: string;
  created_at: string; updated_at: string;
}

const DOC_STATUS = ["draft", "review", "approved", "archived"];
const STATUS_COLOR: Record<string, { bg: string; color: string }> = {
  draft:    { bg: "rgba(255,255,255,0.06)", color: "var(--text-secondary)" },
  review:   { bg: "rgba(255,255,255,0.1)",  color: "var(--text-primary)" },
  approved: { bg: "rgba(255,255,255,0.14)", color: "var(--text-primary)" },
  archived: { bg: "rgba(255,255,255,0.04)", color: "var(--text-muted)" },
};
const STATUS_ICON: Record<string, React.ReactNode> = {
  draft: <Edit3 size={11} />, review: <Clock size={11} />,
  approved: <CheckCircle size={11} />, archived: <AlertCircle size={11} />,
};

const DEFAULT_FOLDERS = ["General", "Policies", "Contracts", "Reports", "Templates", "Legal", "Finance", "HR", "Operations"];

const inputCls = "w-full text-sm px-3 py-2 rounded-lg border outline-none";
const inputStyle = { background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-primary)" };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>{label}</label>
      {children}
    </div>
  );
}

function DocIcon({ type }: { type?: string }) {
  const t = (type ?? "").toLowerCase();
  const color = t.includes("pdf") ? "#f0f0f0" : t.includes("doc") ? "#c0c0c0" : t.includes("sheet") ? "#909090" : "var(--text-secondary)";
  return (
    <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
      style={{ background: "rgba(255,255,255,0.08)", color }}>
      <FileText size={16} />
    </div>
  );
}

function DocModal({ initial, folders, onSave, onClose }: {
  initial?: OrgDocument; folders: string[];
  onSave: (d: OrgDocument) => void; onClose: () => void;
}) {
  const [f, setF] = useState({
    name: initial?.name ?? "", description: initial?.description ?? "",
    folder: initial?.folder ?? "General", file_type: initial?.file_type ?? "document",
    status: initial?.status ?? "draft", tags: (initial?.tags ?? []).join(", "),
    expires_at: initial?.expires_at ?? "", file_url: "",
  });
  const [saving, setSaving] = useState(false);
  const upd = (k: string, v: string) => setF(p => ({ ...p, [k]: v }));

  async function save() {
    if (!f.name.trim()) return;
    setSaving(true);
    const body = { ...f, tags: f.tags.split(",").map(t => t.trim()).filter(Boolean), expires_at: f.expires_at || null };
    const res = await fetch("/api/documents", {
      method: initial ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(initial ? { id: initial.id, ...body } : body),
    });
    const d = await res.json();
    setSaving(false);
    onSave(d);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.75)" }}>
      <div className="w-full max-w-lg rounded-2xl border shadow-2xl flex flex-col max-h-[85vh]"
        style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0" style={{ borderColor: "var(--border)" }}>
          <span className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>{initial ? "Edit document" : "New document"}</span>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/5" style={{ color: "var(--text-secondary)" }}><X size={16} /></button>
        </div>
        <div className="overflow-y-auto flex-1 p-5 space-y-3">
          <Field label="Document name *"><input value={f.name} onChange={e => upd("name", e.target.value)} className={inputCls} style={inputStyle} /></Field>
          <Field label="Description"><textarea value={f.description} onChange={e => upd("description", e.target.value)} rows={2} className={`${inputCls} resize-none`} style={inputStyle} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Folder">
              <input value={f.folder} onChange={e => upd("folder", e.target.value)} list="folders" className={inputCls} style={inputStyle} />
              <datalist id="folders">{folders.map(fl => <option key={fl} value={fl} />)}</datalist>
            </Field>
            <Field label="Status">
              <select value={f.status} onChange={e => upd("status", e.target.value)} className={inputCls} style={inputStyle}>
                {DOC_STATUS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="File type">
              <input value={f.file_type} onChange={e => upd("file_type", e.target.value)} list="ftypes" placeholder="pdf, docx, xlsx..." className={inputCls} style={inputStyle} />
              <datalist id="ftypes">{["pdf","docx","xlsx","pptx","csv","document","spreadsheet","presentation"].map(t => <option key={t} value={t} />)}</datalist>
            </Field>
            <Field label="Expires on">
              <input value={f.expires_at} onChange={e => upd("expires_at", e.target.value)} type="date" className={inputCls} style={inputStyle} />
            </Field>
          </div>
          <Field label="Tags (comma-separated)">
            <input value={f.tags} onChange={e => upd("tags", e.target.value)} placeholder="policy, hr, 2025" className={inputCls} style={inputStyle} />
          </Field>
          <Field label="File URL (optional — link to cloud storage)">
            <input value={f.file_url} onChange={e => upd("file_url", e.target.value)} placeholder="https://drive.google.com/..." className={inputCls} style={inputStyle} />
          </Field>
        </div>
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t shrink-0" style={{ borderColor: "var(--border)" }}>
          <button onClick={onClose} className="text-sm px-4 py-2 rounded-lg" style={{ color: "var(--text-secondary)" }}>Cancel</button>
          <button onClick={save} disabled={saving || !f.name.trim()}
            className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg font-medium disabled:opacity-50"
            style={{ background: "var(--accent-purple)", color: "#000" }}>
            {saving && <Loader2 size={13} className="animate-spin" />} Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DocumentsPage() {
  const [docs, setDocs] = useState<OrgDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeFolder, setActiveFolder] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<OrgDocument | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (activeFolder !== "all") params.set("folder", activeFolder);
    if (search) params.set("search", search);
    fetch(`/api/documents?${params}`).then(r => r.json()).then(d => setDocs(Array.isArray(d) ? d : [])).finally(() => setLoading(false));
  }, [activeFolder, search]);

  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [load]);

  async function deleteDoc(id: string) {
    if (!confirm("Delete this document?")) return;
    setDocs(p => p.filter(d => d.id !== id));
    await fetch(`/api/documents?id=${id}`, { method: "DELETE" });
  }

  async function updateStatus(id: string, status: string) {
    setDocs(p => p.map(d => d.id === id ? { ...d, status } : d));
    await fetch("/api/documents", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
  }

  function handleSaved(d: OrgDocument) {
    setDocs(p => { const i = p.findIndex(x => x.id === d.id); if (i >= 0) { const n = [...p]; n[i] = d; return n; } return [d, ...p]; });
    setModal(false); setEditing(null);
  }

  const allFolders = Array.from(new Set([...DEFAULT_FOLDERS, ...docs.map(d => d.folder).filter(Boolean)])) as string[];
  const filtered = docs.filter(d => statusFilter === "all" || d.status === statusFilter);

  const isExpiringSoon = (date?: string) => {
    if (!date) return false;
    const diff = (new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 30;
  };

  const stats = {
    total: docs.length,
    approved: docs.filter(d => d.status === "approved").length,
    review: docs.filter(d => d.status === "review").length,
    expiring: docs.filter(d => isExpiringSoon(d.expires_at)).length,
  };

  return (
    <>
      {(modal || editing) && (
        <DocModal initial={editing ?? undefined} folders={allFolders}
          onSave={handleSaved}
          onClose={() => { setModal(false); setEditing(null); }} />
      )}

      <div className="flex h-full overflow-hidden">
        {/* Sidebar */}
        <div className="w-52 shrink-0 border-r flex flex-col overflow-hidden"
          style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}>
          <div className="p-4 border-b" style={{ borderColor: "var(--border)" }}>
            <div className="flex items-center gap-2">
              <FolderOpen size={14} style={{ color: "var(--text-primary)" }} />
              <span className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Documents</span>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-3">
              {[
                { label: "Total", val: stats.total },
                { label: "Approved", val: stats.approved },
                { label: "In Review", val: stats.review },
                { label: "Expiring", val: stats.expiring },
              ].map(s => (
                <div key={s.label} className="rounded-lg p-2 text-center" style={{ background: "var(--bg-primary)" }}>
                  <p className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{s.val}</p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>{s.label}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
            <button onClick={() => setActiveFolder("all")}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left"
              style={{ background: activeFolder === "all" ? "var(--bg-active)" : "transparent", color: activeFolder === "all" ? "var(--text-primary)" : "var(--text-secondary)" }}>
              <File size={13} /> All documents
              <span className="ml-auto text-xs" style={{ color: "var(--text-muted)" }}>{docs.length}</span>
            </button>
            {allFolders.map(f => (
              <button key={f} onClick={() => setActiveFolder(f)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left"
                style={{ background: activeFolder === f ? "var(--bg-active)" : "transparent", color: activeFolder === f ? "var(--text-primary)" : "var(--text-secondary)" }}>
                <FolderOpen size={13} /> {f}
                <span className="ml-auto text-xs" style={{ color: "var(--text-muted)" }}>
                  {docs.filter(d => d.folder === f).length}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Main */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-3 border-b shrink-0" style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}>
            <div className="relative flex-1 max-w-sm">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-secondary)" }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search documents..."
                className="w-full text-sm pl-9 pr-3 py-1.5 rounded-lg border outline-none"
                style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-primary)" }} />
            </div>
            <div className="flex gap-1">
              {["all", ...DOC_STATUS].map(s => (
                <button key={s} onClick={() => setStatusFilter(s)}
                  className="text-xs px-2.5 py-1.5 rounded-lg capitalize"
                  style={{
                    background: statusFilter === s ? "rgba(255,255,255,0.12)" : "transparent",
                    color: statusFilter === s ? "var(--text-primary)" : "var(--text-secondary)",
                    border: "1px solid var(--border)",
                  }}>
                  {s}
                </button>
              ))}
            </div>
            <button onClick={() => { setEditing(null); setModal(true); }}
              className="flex items-center gap-1.5 text-sm px-4 py-1.5 rounded-lg font-medium"
              style={{ background: "var(--accent-purple)", color: "#000" }}>
              <Plus size={13} /> New
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5">
            {loading ? (
              <div className="flex justify-center py-20"><Loader2 size={22} className="animate-spin" style={{ color: "var(--text-secondary)" }} /></div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16">
                <FolderOpen size={32} className="mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
                <p className="text-sm font-medium mb-1" style={{ color: "var(--text-primary)" }}>No documents</p>
                <p className="text-xs" style={{ color: "var(--text-secondary)" }}>Upload policies, contracts, reports, and any organization documents.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.map(d => (
                  <div key={d.id} className="rounded-xl border p-4 flex items-start gap-4 hover:border-white/20 transition-colors group"
                    style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
                    <DocIcon type={d.file_type} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2">
                        <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{d.name}</p>
                        <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full shrink-0 capitalize"
                          style={{ background: STATUS_COLOR[d.status ?? "draft"]?.bg, color: STATUS_COLOR[d.status ?? "draft"]?.color }}>
                          {STATUS_ICON[d.status ?? "draft"]} {d.status ?? "draft"}
                        </span>
                        {isExpiringSoon(d.expires_at) && (
                          <span className="text-xs px-2 py-0.5 rounded-full"
                            style={{ background: "rgba(255,255,255,0.08)", color: "var(--text-primary)" }}>
                            Expires {d.expires_at}
                          </span>
                        )}
                      </div>
                      {d.description && <p className="text-xs mt-0.5 line-clamp-1" style={{ color: "var(--text-secondary)" }}>{d.description}</p>}
                      <div className="flex items-center gap-3 mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
                        <span className="flex items-center gap-1"><FolderOpen size={10} />{d.folder}</span>
                        {d.author_name && <span>{d.author_name}</span>}
                        <span>v{d.version ?? 1}</span>
                        <span className="flex items-center gap-1"><Calendar size={10} />{new Date(d.updated_at).toLocaleDateString()}</span>
                        {d.tags?.slice(0, 3).map(t => (
                          <span key={t} className="flex items-center gap-1"><Tag size={9} />{t}</span>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      {/* Quick status change */}
                      <select value={d.status ?? "draft"} onChange={e => updateStatus(d.id, e.target.value)}
                        className="text-xs px-2 py-1 rounded border outline-none mr-1"
                        style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-secondary)" }}
                        onClick={e => e.stopPropagation()}>
                        {DOC_STATUS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <button onClick={() => { setEditing(d); setModal(true); }} className="p-1.5 rounded hover:bg-white/5" style={{ color: "var(--text-secondary)" }}><Edit3 size={13} /></button>
                      <button onClick={() => deleteDoc(d.id)} className="p-1.5 rounded hover:bg-red-500/10" style={{ color: "var(--danger)" }}><Trash2 size={13} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
