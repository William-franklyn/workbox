"use client";
import { use, useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Upload, Link2, Trash2, ExternalLink, Download, FolderOpen,
  FileText, Film, ImageIcon, File, Plus, X, Loader2,
} from "lucide-react";

interface Resource {
  id: string;
  folder_id: string;
  type: string;
  name: string;
  url?: string;
  storage_path?: string;
  file_type?: string;
  size?: number;
  created_at: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function detectType(url: string): string {
  try {
    const h = new URL(url).hostname;
    if (h.includes("drive.google.com"))  return "google-drive";
    if (h.includes("docs.google.com"))   return "google-docs";
    if (h.includes("sheets.google.com")) return "google-sheets";
    if (h.includes("slides.google.com")) return "google-slides";
    if (h.includes("dropbox.com"))       return "dropbox";
    if (h.includes("github.com"))        return "github";
    if (h.includes("figma.com"))         return "figma";
    if (h.includes("notion.so"))         return "notion";
    if (h.includes("youtube.com") || h.includes("youtu.be")) return "youtube";
    if (h.includes("loom.com"))          return "loom";
    if (h.includes("miro.com"))          return "miro";
    if (h.includes("linear.app"))        return "linear";
  } catch { /* noop */ }
  return "link";
}

const TYPE_META: Record<string, { label: string; color: string; bg: string }> = {
  "google-drive":  { label: "Google Drive",  color: "#4285f4", bg: "#4285f410" },
  "google-docs":   { label: "Google Docs",   color: "#4285f4", bg: "#4285f410" },
  "google-sheets": { label: "Google Sheets", color: "#0f9d58", bg: "#0f9d5810" },
  "google-slides": { label: "Google Slides", color: "#f4b400", bg: "#f4b40010" },
  "dropbox":       { label: "Dropbox",       color: "#0061ff", bg: "#0061ff10" },
  "github":        { label: "GitHub",        color: "#e6edf3", bg: "#ffffff08" },
  "figma":         { label: "Figma",         color: "#a259ff", bg: "#a259ff12" },
  "notion":        { label: "Notion",        color: "#e3e3e1", bg: "#ffffff08" },
  "youtube":       { label: "YouTube",       color: "#ff0000", bg: "#ff000010" },
  "loom":          { label: "Loom",          color: "#625df5", bg: "#625df512" },
  "miro":          { label: "Miro",          color: "#ffdd00", bg: "#ffdd0010" },
  "linear":        { label: "Linear",        color: "#5e6ad2", bg: "#5e6ad212" },
  "link":          { label: "Link",          color: "#94a3b8", bg: "#ffffff08" },
  "pdf":           { label: "PDF",           color: "#ef4444", bg: "#ef444412" },
  "docx":          { label: "Word",          color: "#2b7cd3", bg: "#2b7cd312" },
  "xlsx":          { label: "Excel",         color: "#0f9d58", bg: "#0f9d5810" },
  "pptx":          { label: "PowerPoint",    color: "#d04423", bg: "#d0442312" },
  "png":           { label: "Image",         color: "#8b5cf6", bg: "#8b5cf612" },
  "jpg":           { label: "Image",         color: "#8b5cf6", bg: "#8b5cf612" },
  "jpeg":          { label: "Image",         color: "#8b5cf6", bg: "#8b5cf612" },
  "mp4":           { label: "Video",         color: "#f59e0b", bg: "#f59e0b12" },
  "mov":           { label: "Video",         color: "#f59e0b", bg: "#f59e0b12" },
};

function typeMeta(type: string) {
  return TYPE_META[type] ?? { label: type.toUpperCase(), color: "#94a3b8", bg: "#ffffff08" };
}

function TypeIcon({ type, size = 18 }: { type: string; size?: number }) {
  const color = typeMeta(type).color;
  if (type === "github")    return <span className="font-bold text-sm" style={{ color }}>GH</span>;
  if (type === "figma")     return <span className="font-bold text-sm" style={{ color }}>Fi</span>;
  if (type === "youtube")   return <Film size={size} style={{ color: "#ff0000" }} />;
  if (type === "loom")      return <Film size={size} style={{ color }} />;
  if (type === "png" || type === "jpg" || type === "jpeg") return <ImageIcon size={size} style={{ color }} />;
  if (type === "mp4" || type === "mov") return <Film size={size} style={{ color }} />;
  if (type === "pdf" || type === "docx" || type === "txt") return <FileText size={size} style={{ color }} />;
  if (type.startsWith("google")) {
    const letter = type.includes("docs") ? "D" : type.includes("sheets") ? "S" : type.includes("slides") ? "P" : "G";
    return (
      <span className="font-bold text-sm" style={{ color, fontFamily: "sans-serif" }}>{letter}</span>
    );
  }
  if (type === "dropbox") return <span className="font-bold text-sm" style={{ color }}>⬡</span>;
  if (type === "notion")  return <span className="font-bold text-sm" style={{ color }}>N</span>;
  if (type === "miro")    return <span className="font-bold text-sm" style={{ color }}>M</span>;
  if (type === "linear")  return <span className="font-bold text-sm" style={{ color }}>L</span>;
  return <Link2 size={size} style={{ color }} />;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// ── Add Resource Modal ────────────────────────────────────────────────────────

function AddResourceModal({ folderId, onClose, onAdded }: {
  folderId: string;
  onClose: () => void;
  onAdded: (r: Resource) => void;
}) {
  const [tab, setTab] = useState<"upload" | "link">("upload");
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<string>("");
  const [url, setUrl] = useState("");
  const [linkName, setLinkName] = useState("");
  const [linkType, setLinkType] = useState("link");
  const [addingLink, setAddingLink] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  function onUrlChange(val: string) {
    setUrl(val);
    if (val) setLinkType(detectType(val));
  }

  async function uploadFile(file: File) {
    setUploading(true);
    setProgress(`Uploading ${file.name}…`);
    setError("");
    const form = new FormData();
    form.append("file", file);
    form.append("folderId", folderId);
    const res = await fetch("/api/folder-resources", { method: "POST", body: form });
    const data = await res.json();
    setUploading(false);
    setProgress("");
    if (!res.ok) { setError(data.error ?? "Upload failed"); return; }
    onAdded(data);
    onClose();
  }

  async function addLink() {
    if (!url.trim()) return;
    setAddingLink(true);
    setError("");
    const res = await fetch("/api/folder-resources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folderId, type: linkType, name: linkName.trim() || url.trim(), url: url.trim() }),
    });
    const data = await res.json();
    setAddingLink(false);
    if (!res.ok) { setError(data.error ?? "Failed to add link"); return; }
    onAdded(data);
    onClose();
  }

  const SOURCES = [
    { key: "google-drive",  label: "Google Drive",  hint: "Share the file/folder and paste the link" },
    { key: "dropbox",       label: "Dropbox",        hint: "Create a shared link and paste it here" },
    { key: "github",        label: "GitHub",         hint: "Paste a repo, PR, or file URL" },
    { key: "figma",         label: "Figma",          hint: "Share the file and paste the link" },
    { key: "notion",        label: "Notion",         hint: "Share the page and paste the link" },
    { key: "loom",          label: "Loom",           hint: "Paste a Loom video share link" },
    { key: "miro",          label: "Miro",           hint: "Share a board and paste the link" },
    { key: "youtube",       label: "YouTube",        hint: "Paste a YouTube video URL" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden"
        style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}
        onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
          <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Add Resource</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/10" style={{ color: "var(--text-secondary)" }}>
            <X size={15} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b" style={{ borderColor: "var(--border)" }}>
          {([["upload", "Upload File"], ["link", "Add Link"]] as const).map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              className="flex-1 py-2.5 text-xs font-medium border-b-2 transition-colors"
              style={{
                borderColor: tab === key ? "var(--accent-purple)" : "transparent",
                color: tab === key ? "var(--accent-purple)" : "var(--text-secondary)",
              }}>
              {label}
            </button>
          ))}
        </div>

        <div className="p-5">
          {tab === "upload" ? (
            <div>
              {/* Drag & drop zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) uploadFile(f); }}
                onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all"
                style={{
                  borderColor: dragging ? "var(--accent-purple)" : "var(--border)",
                  background: dragging ? "rgba(124,58,237,0.06)" : "transparent",
                }}>
                <input ref={fileRef} type="file" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f); }} />
                {uploading ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 size={28} className="animate-spin" style={{ color: "var(--accent-purple)" }} />
                    <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{progress}</p>
                  </div>
                ) : (
                  <>
                    <Upload size={28} className="mx-auto mb-3" style={{ color: "var(--text-secondary)", opacity: 0.5 }} />
                    <p className="text-sm font-medium mb-1" style={{ color: "var(--text-primary)" }}>
                      Drop a file here or click to browse
                    </p>
                    <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                      PDF, Word, Excel, PowerPoint, images, videos — any file type
                    </p>
                  </>
                )}
              </div>

              {/* Quick source buttons */}
              <div className="mt-4">
                <p className="text-xs mb-2" style={{ color: "var(--text-secondary)" }}>Or switch to "Add Link" to attach from:</p>
                <div className="flex flex-wrap gap-1.5">
                  {SOURCES.slice(0, 5).map((s) => (
                    <button key={s.key} onClick={() => setTab("link")}
                      className="text-xs px-2.5 py-1 rounded-full border transition-colors hover:border-purple-500/50"
                      style={{ borderColor: "var(--border)", color: typeMeta(s.key).color }}>
                      {s.label}
                    </button>
                  ))}
                  <button onClick={() => setTab("link")}
                    className="text-xs px-2.5 py-1 rounded-full border transition-colors hover:border-purple-500/50"
                    style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
                    + more
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Popular sources */}
              <div>
                <p className="text-xs font-medium mb-2" style={{ color: "var(--text-secondary)" }}>Popular sources</p>
                <div className="grid grid-cols-4 gap-2">
                  {SOURCES.map((s) => (
                    <button key={s.key}
                      onClick={() => { setLinkType(s.key); }}
                      className="flex flex-col items-center gap-1.5 py-2.5 rounded-xl border text-xs transition-all hover:scale-105"
                      style={{
                        borderColor: linkType === s.key ? typeMeta(s.key).color : "var(--border)",
                        background: linkType === s.key ? typeMeta(s.key).bg : "transparent",
                        color: "var(--text-secondary)",
                      }}>
                      <TypeIcon type={s.key} size={16} />
                      <span style={{ color: linkType === s.key ? typeMeta(s.key).color : "var(--text-secondary)" }}>
                        {s.label}
                      </span>
                    </button>
                  ))}
                </div>
                {linkType !== "link" && (
                  <p className="text-xs mt-2 px-1" style={{ color: "var(--text-secondary)" }}>
                    💡 {SOURCES.find(s => s.key === linkType)?.hint}
                  </p>
                )}
              </div>

              {/* URL input */}
              <div>
                <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--text-secondary)" }}>URL *</label>
                <input value={url} onChange={(e) => onUrlChange(e.target.value)}
                  placeholder="Paste a link from any source…"
                  className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                  style={{ background: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
                  onFocus={(e) => (e.target.style.borderColor = "var(--accent-purple)")}
                  onBlur={(e) => (e.target.style.borderColor = "var(--border)")} />
                {url && (
                  <p className="text-xs mt-1 px-1" style={{ color: typeMeta(linkType).color }}>
                    Detected: {typeMeta(linkType).label}
                  </p>
                )}
              </div>

              {/* Name input */}
              <div>
                <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--text-secondary)" }}>
                  Display name <span style={{ fontWeight: 400 }}>(optional)</span>
                </label>
                <input value={linkName} onChange={(e) => setLinkName(e.target.value)}
                  placeholder="e.g. Q2 Design Mockups"
                  className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                  style={{ background: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
                  onFocus={(e) => (e.target.style.borderColor = "var(--accent-purple)")}
                  onBlur={(e) => (e.target.style.borderColor = "var(--border)")} />
              </div>

              <button onClick={addLink} disabled={!url.trim() || addingLink}
                className="w-full py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40 transition-opacity hover:opacity-90"
                style={{ background: "var(--accent-purple)" }}>
                {addingLink ? "Adding…" : "Add Link"}
              </button>
            </div>
          )}

          {error && <p className="text-xs mt-3" style={{ color: "var(--danger)" }}>{error}</p>}
        </div>
      </div>
    </div>
  );
}

// ── Resource Card ─────────────────────────────────────────────────────────────

function ResourceCard({ resource, onDelete }: { resource: Resource; onDelete: () => void }) {
  const meta = typeMeta(resource.type);
  const isFile = !!resource.storage_path;

  async function openFile() {
    const supabase = createClient();
    const { data } = await supabase.storage.from("documents")
      .createSignedUrl(resource.storage_path!, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  }

  return (
    <div className="group relative flex flex-col gap-3 p-4 rounded-xl border transition-all hover:border-purple-500/30"
      style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>

      {/* Delete */}
      <button onClick={onDelete}
        className="absolute top-3 right-3 p-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>
        <Trash2 size={12} />
      </button>

      {/* Icon */}
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: meta.bg }}>
        <TypeIcon type={resource.type} size={20} />
      </div>

      {/* Info */}
      <div className="min-w-0">
        <p className="text-sm font-medium truncate pr-6" style={{ color: "var(--text-primary)" }}>{resource.name}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs px-1.5 py-0.5 rounded-full font-medium"
            style={{ background: meta.bg, color: meta.color }}>{meta.label}</span>
          {resource.size && (
            <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{formatSize(resource.size)}</span>
          )}
        </div>
        <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
          {new Date(resource.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
        </p>
      </div>

      {/* Action */}
      <button
        onClick={isFile ? openFile : () => window.open(resource.url, "_blank")}
        className="flex items-center justify-center gap-1.5 w-full py-2 rounded-lg text-xs font-medium transition-colors hover:opacity-90"
        style={{ background: meta.bg, color: meta.color }}>
        {isFile ? <Download size={12} /> : <ExternalLink size={12} />}
        {isFile ? "Download" : "Open"}
      </button>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function FolderResourcesPage({ params }: { params: Promise<{ folderId: string }> }) {
  const { folderId } = use(params);
  const [folder, setFolder] = useState<{ id: string; name: string } | null>(null);
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/folder-resources?folderId=${folderId}`);
    if (!res.ok) return;
    const data = await res.json();
    setFolder(data.folder);
    setResources(data.resources);
    setLoading(false);
  }, [folderId]);

  useEffect(() => { load(); }, [load]);

  async function deleteResource(r: Resource) {
    if (!confirm(`Remove "${r.name}"?`)) return;
    setResources((prev) => prev.filter((x) => x.id !== r.id));
    await fetch("/api/folder-resources", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: r.id, storagePath: r.storage_path }),
    });
  }

  const filtered = resources.filter((r) =>
    !search || r.name.toLowerCase().includes(search.toLowerCase()) || r.type.includes(search.toLowerCase())
  );

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto p-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(124,58,237,0.12)" }}>
              <FolderOpen size={20} style={{ color: "var(--accent-purple)" }} />
            </div>
            <div>
              <h1 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
                {folder?.name ?? "Folder"} — Resources
              </h1>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                {resources.length} resource{resources.length !== 1 ? "s" : ""} · shared with the team
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search resources…"
              className="px-3 py-1.5 rounded-lg text-xs outline-none"
              style={{ background: "var(--bg-secondary)", color: "var(--text-primary)", border: "1px solid var(--border)", width: 180 }} />
            <button onClick={() => setModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white hover:opacity-90 transition-opacity"
              style={{ background: "var(--accent-purple)" }}>
              <Plus size={14} /> Add Resource
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={22} className="animate-spin" style={{ color: "var(--text-secondary)" }} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: "rgba(124,58,237,0.08)" }}>
              <File size={28} style={{ color: "var(--accent-purple)", opacity: 0.6 }} />
            </div>
            <p className="text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
              {search ? "No resources match your search" : "No resources yet"}
            </p>
            <p className="text-xs mb-5" style={{ color: "var(--text-secondary)" }}>
              Upload files or add links from Google Drive, Dropbox, GitHub, Figma and more.
            </p>
            {!search && (
              <button onClick={() => setModal(true)}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-opacity"
                style={{ background: "var(--accent-purple)" }}>
                <Plus size={15} /> Add your first resource
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {filtered.map((r) => (
              <ResourceCard key={r.id} resource={r} onDelete={() => deleteResource(r)} />
            ))}
            <button onClick={() => setModal(true)}
              className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed min-h-40 hover:border-purple-500/40 transition-colors"
              style={{ borderColor: "var(--border)" }}>
              <Plus size={20} style={{ color: "var(--text-secondary)", opacity: 0.5 }} />
              <span className="text-xs" style={{ color: "var(--text-secondary)" }}>Add resource</span>
            </button>
          </div>
        )}
      </div>

      {modal && (
        <AddResourceModal
          folderId={folderId}
          onClose={() => setModal(false)}
          onAdded={(r) => setResources((prev) => [r, ...prev])}
        />
      )}
    </div>
  );
}
