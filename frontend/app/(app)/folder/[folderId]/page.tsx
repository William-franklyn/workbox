"use client";
import { use, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Upload, Link2, Trash2, ExternalLink, Download, FolderOpen,
  FileText, Film, ImageIcon, File, Plus, X, Loader2,
  Copy, Check, Table2, FileEdit, ChevronDown,
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

interface Sheet {
  id: string;
  name: string;
  col_headers: string[];
  created_at: string;
  updated_at: string;
}

// ── Type helpers ──────────────────────────────────────────────────────────────

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
  "google-drive":  { label: "Google Drive",  color: "#4285f4", bg: "#4285f412" },
  "google-docs":   { label: "Google Docs",   color: "#4285f4", bg: "#4285f412" },
  "google-sheets": { label: "Sheets",        color: "#0f9d58", bg: "#0f9d5812" },
  "google-slides": { label: "Slides",        color: "#f4b400", bg: "#f4b40012" },
  "dropbox":       { label: "Dropbox",       color: "#0061ff", bg: "#0061ff12" },
  "github":        { label: "GitHub",        color: "#7d8590", bg: "#ffffff08" },
  "figma":         { label: "Figma",         color: "#a259ff", bg: "#a259ff12" },
  "notion":        { label: "Notion",        color: "#e3e3e1", bg: "#ffffff08" },
  "youtube":       { label: "YouTube",       color: "#ff0000", bg: "#ff000012" },
  "loom":          { label: "Loom",          color: "#625df5", bg: "#625df512" },
  "miro":          { label: "Miro",          color: "#ffdd00", bg: "#ffdd0010" },
  "linear":        { label: "Linear",        color: "#5e6ad2", bg: "#5e6ad212" },
  "link":          { label: "Link",          color: "#94a3b8", bg: "#ffffff08" },
  "pdf":           { label: "PDF",           color: "#ef4444", bg: "#ef444412" },
  "docx":          { label: "Word",          color: "#2b7cd3", bg: "#2b7cd312" },
  "doc":           { label: "Word",          color: "#2b7cd3", bg: "#2b7cd312" },
  "xlsx":          { label: "Excel",         color: "#0f9d58", bg: "#0f9d5812" },
  "xls":           { label: "Excel",         color: "#0f9d58", bg: "#0f9d5812" },
  "pptx":          { label: "PowerPoint",    color: "#d04423", bg: "#d0442312" },
  "ppt":           { label: "PowerPoint",    color: "#d04423", bg: "#d0442312" },
  "png":           { label: "Image",         color: "#8b5cf6", bg: "#8b5cf612" },
  "jpg":           { label: "Image",         color: "#8b5cf6", bg: "#8b5cf612" },
  "jpeg":          { label: "Image",         color: "#8b5cf6", bg: "#8b5cf612" },
  "gif":           { label: "Image",         color: "#8b5cf6", bg: "#8b5cf612" },
  "webp":          { label: "Image",         color: "#8b5cf6", bg: "#8b5cf612" },
  "svg":           { label: "SVG",           color: "#f59e0b", bg: "#f59e0b12" },
  "mp4":           { label: "Video",         color: "#f59e0b", bg: "#f59e0b12" },
  "mov":           { label: "Video",         color: "#f59e0b", bg: "#f59e0b12" },
  "webm":          { label: "Video",         color: "#f59e0b", bg: "#f59e0b12" },
  "txt":           { label: "Text",          color: "#94a3b8", bg: "#ffffff08" },
  "csv":           { label: "CSV",           color: "#0f9d58", bg: "#0f9d5812" },
  "spreadsheet":   { label: "Spreadsheet",   color: "#22c55e", bg: "#22c55e12" },
};

function typeMeta(type: string) {
  return TYPE_META[type] ?? { label: type.toUpperCase(), color: "#94a3b8", bg: "#ffffff08" };
}

function TypeIcon({ type, size = 18 }: { type: string; size?: number }) {
  const { color } = typeMeta(type);
  if (type === "spreadsheet")  return <Table2 size={size} style={{ color: "#22c55e" }} />;
  if (type === "github")       return <span className="font-bold text-xs" style={{ color }}>GH</span>;
  if (type === "figma")        return <span className="font-bold text-xs" style={{ color }}>Fi</span>;
  if (type === "notion")       return <span className="font-bold text-xs" style={{ color }}>N</span>;
  if (type === "miro")         return <span className="font-bold text-xs" style={{ color }}>Mi</span>;
  if (type === "linear")       return <span className="font-bold text-xs" style={{ color }}>Li</span>;
  if (type === "dropbox")      return <span className="font-bold text-xs" style={{ color }}>Db</span>;
  if (type.startsWith("google")) {
    const l = type.includes("docs") ? "D" : type.includes("sheets") ? "S" : type.includes("slides") ? "P" : "G";
    return <span className="font-bold text-sm" style={{ color }}>{l}</span>;
  }
  if (type === "youtube" || type === "loom" || type.match(/^(mp4|mov|webm|avi)$/)) return <Film size={size} style={{ color }} />;
  if (type.match(/^(png|jpg|jpeg|gif|webp|svg)$/)) return <ImageIcon size={size} style={{ color }} />;
  if (type.match(/^(pdf|docx?|txt|csv|md)$/)) return <FileText size={size} style={{ color }} />;
  return <Link2 size={size} style={{ color }} />;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

// ── CSV parser (handles quoted fields and CRLF) ───────────────────────────────

function parseCSV(raw: string): string[][] {
  const rows: string[][] = [];
  const text = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = text.split("\n");
  for (const line of lines) {
    if (!line.trim()) continue;
    const cells: string[] = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = !inQ;
      } else if (ch === "," && !inQ) {
        cells.push(cur); cur = "";
      } else {
        cur += ch;
      }
    }
    cells.push(cur);
    rows.push(cells);
  }
  return rows;
}

// ── File Viewer Modal ─────────────────────────────────────────────────────────

function FileViewerModal({ resource, onClose }: { resource: Resource; onClose: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [textError, setTextError] = useState<string | null>(null);
  const [loadingUrl, setLoadingUrl] = useState(true);
  const [loadingText, setLoadingText] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [csvRaw, setCsvRaw] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (resource.storage_path) {
      fetch(`/api/storage-url?path=${encodeURIComponent(resource.storage_path)}&bucket=documents`)
        .then(r => r.json())
        .then(d => {
          if (d.error) { setUrlError(d.error); setLoadingUrl(false); return; }
          const signed: string = d.url;
          setUrl(signed);
          setLoadingUrl(false);
          const t = (resource.file_type ?? resource.type).toLowerCase();
          if (/^(txt|csv|md|json)$/.test(t)) {
            setLoadingText(true);
            fetch(signed)
              .then(r => {
                if (!r.ok) throw new Error(`HTTP ${r.status}`);
                return r.text();
              })
              .then(text => { setTextContent(text); setLoadingText(false); })
              .catch(err => { setTextError(String(err)); setLoadingText(false); });
          }
        })
        .catch(err => { setUrlError(String(err)); setLoadingUrl(false); });
    } else {
      setUrl(resource.url ?? null);
      setLoadingUrl(false);
    }
  }, [resource]);

  const fileType = (resource.file_type ?? resource.type).toLowerCase();
  const isImage  = /^(png|jpg|jpeg|gif|webp|svg)$/.test(fileType);
  const isVideo  = /^(mp4|mov|webm|avi)$/.test(fileType);
  const isPdf    = fileType === "pdf";
  const isOffice = /^(docx?|xlsx?|pptx?|odt|ods)$/.test(fileType);
  const isText   = /^(txt|md|csv|json)$/.test(fileType);
  const isCsv    = fileType === "csv";
  const isLink   = !resource.storage_path;

  function renderBody() {
    if (loadingUrl) return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 size={28} className="animate-spin" style={{ color: "var(--text-secondary)" }} />
      </div>
    );
    if (urlError) return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8 text-center">
        <File size={36} style={{ color: "var(--text-secondary)", opacity: 0.4 }} />
        <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Could not load file</p>
        <p className="text-xs max-w-sm" style={{ color: "#ef4444" }}>{urlError}</p>
        <p className="text-xs max-w-sm" style={{ color: "var(--text-secondary)" }}>
          Make sure the <strong>documents</strong> bucket exists in Supabase Storage and is set to Private.
        </p>
      </div>
    );
    if (!url) return (
      <div className="flex-1 flex items-center justify-center text-sm" style={{ color: "var(--text-secondary)" }}>
        No file URL found.
      </div>
    );

    if (isLink) return (
      <div className="flex-1 flex flex-col items-center justify-center gap-5 p-10 text-center">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{ background: typeMeta(resource.type).bg }}>
          <TypeIcon type={resource.type} size={32} />
        </div>
        <div>
          <h2 className="text-lg font-bold mb-1" style={{ color: "var(--text-primary)" }}>{resource.name}</h2>
          <p className="text-xs mb-4" style={{ color: "var(--text-secondary)" }}>{typeMeta(resource.type).label}</p>
        </div>
        <div className="flex items-center gap-2 max-w-lg w-full px-4 py-3 rounded-xl"
          style={{ background: "var(--bg-primary)", border: "1px solid var(--border)" }}>
          <span className="flex-1 text-sm truncate" style={{ color: "var(--text-secondary)" }}>{url}</span>
          <button onClick={() => navigator.clipboard.writeText(url)}
            className="shrink-0 p-1.5 rounded-lg hover:bg-white/10 transition-colors" style={{ color: "var(--accent-purple)" }}>
            <Copy size={14} />
          </button>
        </div>
        <a href={url} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90"
          style={{ background: "var(--accent-purple)" }}>
          <ExternalLink size={14} /> Open in new tab
        </a>
      </div>
    );

    if (isImage) return (
      <div className="flex-1 flex items-center justify-center p-4 overflow-auto">
        <img src={url} alt={resource.name} className="max-w-full max-h-full object-contain rounded-lg" />
      </div>
    );

    if (isVideo) return (
      <div className="flex-1 flex items-center justify-center p-4" style={{ background: "#000" }}>
        <video src={url} controls autoPlay className="max-w-full max-h-full rounded-lg" />
      </div>
    );

    if (isPdf) return (
      <iframe src={url} title={resource.name} className="flex-1 border-0 w-full" style={{ minHeight: 0 }} />
    );

    if (isOffice) return (
      <iframe
        src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`}
        title={resource.name} className="flex-1 border-0 w-full" style={{ minHeight: 0 }}
      />
    );

    if (isText) {
      if (loadingText) return (
        <div className="flex-1 flex flex-col items-center justify-center gap-2">
          <Loader2 size={22} className="animate-spin" style={{ color: "var(--text-secondary)" }} />
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>Loading content…</p>
        </div>
      );
      if (textError) return (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8 text-center">
          <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Could not read file content</p>
          <p className="text-xs" style={{ color: "#ef4444" }}>{textError}</p>
          <a href={url} download={resource.name}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white"
            style={{ background: "var(--accent-purple)" }}>
            <Download size={13} /> Download instead
          </a>
        </div>
      );
      if (textContent === null) return (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 size={22} className="animate-spin" style={{ color: "var(--text-secondary)" }} />
        </div>
      );

      if (isCsv && !csvRaw) {
        const parsed = parseCSV(textContent);
        return (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-4 py-2 border-b flex items-center justify-between shrink-0"
              style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}>
              <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                {parsed.length > 0 ? `${parsed.length - 1} rows · ${parsed[0]?.length ?? 0} columns` : "Empty file"}
              </span>
              <button onClick={() => setCsvRaw(true)} className="text-xs hover:underline" style={{ color: "var(--accent-purple)" }}>
                View raw
              </button>
            </div>
            <div className="flex-1 overflow-auto">
              <table className="border-collapse text-xs w-full">
                <thead className="sticky top-0" style={{ background: "var(--bg-secondary)" }}>
                  {parsed[0] && (
                    <tr>
                      <th className="w-10 px-3 py-2 border-b border-r text-center"
                        style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>#</th>
                      {parsed[0].map((cell, ci) => (
                        <th key={ci} className="px-3 py-2 border-b border-r text-left font-semibold"
                          style={{ borderColor: "var(--border)", color: "var(--accent-purple)", whiteSpace: "nowrap" }}>
                          {cell}
                        </th>
                      ))}
                    </tr>
                  )}
                </thead>
                <tbody>
                  {parsed.slice(1).map((row, ri) => (
                    <tr key={ri} className="hover:bg-white/3 transition-colors">
                      <td className="px-3 py-2 border-b border-r text-center"
                        style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>{ri + 1}</td>
                      {row.map((cell, ci) => (
                        <td key={ci} className="px-3 py-2 border-b border-r"
                          style={{ borderColor: "var(--border)", color: "var(--text-primary)", whiteSpace: "nowrap" }}>
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsed.length <= 1 && (
                <p className="text-center py-10 text-xs" style={{ color: "var(--text-secondary)" }}>No data rows found.</p>
              )}
            </div>
          </div>
        );
      }

      return (
        <div className="flex-1 flex flex-col overflow-hidden">
          {isCsv && (
            <div className="px-4 py-2 border-b flex items-center justify-end shrink-0"
              style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}>
              <button onClick={() => setCsvRaw(false)} className="text-xs hover:underline" style={{ color: "var(--accent-purple)" }}>
                View as table
              </button>
            </div>
          )}
          <pre className="flex-1 overflow-auto p-6 text-sm leading-relaxed"
            style={{ color: "var(--text-primary)", fontFamily: "monospace", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
            {textContent}
          </pre>
        </div>
      );
    }

    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
        <File size={40} style={{ color: "var(--text-secondary)", opacity: 0.4 }} />
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Preview not available for .{fileType} files</p>
        <a href={url} download={resource.name}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
          style={{ background: "var(--accent-purple)" }}>
          <Download size={14} /> Download
        </a>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "var(--bg-primary)" }}>
      <div className="flex items-center gap-3 px-4 py-3 border-b shrink-0"
        style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors shrink-0"
          style={{ color: "var(--text-secondary)" }}>
          <X size={16} />
        </button>
        <div className="w-6 h-6 rounded flex items-center justify-center shrink-0"
          style={{ background: typeMeta(resource.type).bg }}>
          <TypeIcon type={resource.type} size={13} />
        </div>
        <span className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{resource.name}</span>
        {url && !isLink && (
          <a href={url} download={resource.name}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs hover:bg-white/5 transition-colors shrink-0"
            style={{ color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
            <Download size={12} /> Download
          </a>
        )}
      </div>
      {renderBody()}
    </div>
  );
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
  const [url, setUrl] = useState("");
  const [linkName, setLinkName] = useState("");
  const [linkType, setLinkType] = useState("link");
  const [addingLink, setAddingLink] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const SOURCES = [
    { key: "google-drive", label: "Google Drive" },
    { key: "dropbox",      label: "Dropbox" },
    { key: "github",       label: "GitHub" },
    { key: "figma",        label: "Figma" },
    { key: "notion",       label: "Notion" },
    { key: "loom",         label: "Loom" },
    { key: "miro",         label: "Miro" },
    { key: "youtube",      label: "YouTube" },
  ];

  const HINTS: Record<string, string> = {
    "google-drive": "Share the file/folder and paste the link",
    "dropbox": "Create a shared link and paste it here",
    "github": "Paste a repo, PR, file or issue URL",
    "figma": "Share the file and paste the link",
    "notion": "Share the page and paste the link",
    "loom": "Paste a Loom video share link",
    "miro": "Share a board and paste the link",
    "youtube": "Paste a YouTube video URL",
  };

  function onUrlChange(val: string) {
    setUrl(val);
    if (val) setLinkType(detectType(val));
  }

  async function uploadFile(file: File) {
    setUploading(true); setError("");
    const form = new FormData();
    form.append("file", file);
    form.append("folderId", folderId);
    const res = await fetch("/api/folder-resources", { method: "POST", body: form });
    const data = await res.json();
    setUploading(false);
    if (!res.ok) { setError(data.error ?? "Upload failed"); return; }
    onAdded(data); onClose();
  }

  async function addLink() {
    if (!url.trim()) return;
    setAddingLink(true); setError("");
    const res = await fetch("/api/folder-resources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folderId, type: linkType, name: linkName.trim() || url.trim(), url: url.trim() }),
    });
    const data = await res.json();
    setAddingLink(false);
    if (!res.ok) { setError(data.error ?? "Failed"); return; }
    onAdded(data); onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden"
        style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
          <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Add Resource</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/10" style={{ color: "var(--text-secondary)" }}><X size={15} /></button>
        </div>
        <div className="flex border-b" style={{ borderColor: "var(--border)" }}>
          {(["upload", "link"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="flex-1 py-2.5 text-xs font-medium border-b-2 transition-colors capitalize"
              style={{ borderColor: tab === t ? "var(--accent-purple)" : "transparent", color: tab === t ? "var(--accent-purple)" : "var(--text-secondary)" }}>
              {t === "upload" ? "Upload File" : "Add Link"}
            </button>
          ))}
        </div>
        <div className="p-5">
          {tab === "upload" ? (
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) uploadFile(f); }}
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all"
              style={{ borderColor: dragging ? "var(--accent-purple)" : "var(--border)", background: dragging ? "rgba(124,58,237,0.06)" : "transparent" }}>
              <input ref={fileRef} type="file" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile(f); }} />
              {uploading ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 size={28} className="animate-spin" style={{ color: "var(--accent-purple)" }} />
                  <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Uploading…</p>
                </div>
              ) : (
                <>
                  <Upload size={28} className="mx-auto mb-3" style={{ color: "var(--text-secondary)", opacity: 0.5 }} />
                  <p className="text-sm font-medium mb-1" style={{ color: "var(--text-primary)" }}>Drop a file or click to browse</p>
                  <p className="text-xs" style={{ color: "var(--text-secondary)" }}>PDF, Word, Excel, images, videos — any file type</p>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-2">
                {SOURCES.map(s => (
                  <button key={s.key} onMouseDown={() => setLinkType(s.key)}
                    className="flex flex-col items-center gap-1.5 py-2.5 rounded-xl border text-xs transition-all hover:scale-105"
                    style={{ borderColor: linkType === s.key ? typeMeta(s.key).color : "var(--border)", background: linkType === s.key ? typeMeta(s.key).bg : "transparent" }}>
                    <TypeIcon type={s.key} size={16} />
                    <span style={{ color: linkType === s.key ? typeMeta(s.key).color : "var(--text-secondary)" }}>{s.label}</span>
                  </button>
                ))}
              </div>
              {HINTS[linkType] && (
                <p className="text-xs px-1" style={{ color: "var(--text-secondary)" }}>💡 {HINTS[linkType]}</p>
              )}
              <input value={url} onChange={e => onUrlChange(e.target.value)} placeholder="Paste link…"
                className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                style={{ background: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
                onFocus={e => (e.target.style.borderColor = "var(--accent-purple)")}
                onBlur={e => (e.target.style.borderColor = "var(--border)")} />
              {url && <p className="text-xs -mt-2 px-1" style={{ color: typeMeta(linkType).color }}>Detected: {typeMeta(linkType).label}</p>}
              <input value={linkName} onChange={e => setLinkName(e.target.value)} placeholder="Display name (optional)"
                className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                style={{ background: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
                onFocus={e => (e.target.style.borderColor = "var(--accent-purple)")}
                onBlur={e => (e.target.style.borderColor = "var(--border)")} />
              <button onClick={addLink} disabled={!url.trim() || addingLink}
                className="w-full py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40 hover:opacity-90 transition-opacity"
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

function ResourceCard({ resource, onDelete, onView }: {
  resource: Resource;
  onDelete: () => void;
  onView: () => void;
}) {
  const meta = typeMeta(resource.type);
  const isFile = !!resource.storage_path;
  const isLink = !isFile;
  const [copied, setCopied] = useState(false);

  function copyLink() {
    if (resource.url) {
      navigator.clipboard.writeText(resource.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="group relative flex flex-col gap-3 p-4 rounded-xl border transition-all hover:border-purple-500/30"
      style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
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

      {/* Name + badge */}
      <div className="min-w-0">
        <p className="text-sm font-medium truncate pr-6" style={{ color: "var(--text-primary)" }}>{resource.name}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs px-1.5 py-0.5 rounded-full font-medium"
            style={{ background: meta.bg, color: meta.color }}>{meta.label}</span>
          {resource.size && <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{formatSize(resource.size)}</span>}
        </div>
        {/* Show URL for links */}
        {isLink && resource.url && (
          <p className="text-xs mt-1.5 truncate" style={{ color: "var(--text-secondary)" }}>
            {resource.url}
          </p>
        )}
        <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
          {new Date(resource.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
        </p>
      </div>

      {/* Actions */}
      {isFile ? (
        <div className="flex gap-2">
          <button onClick={onView}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium hover:opacity-90 transition-opacity"
            style={{ background: meta.bg, color: meta.color }}>
            <FileEdit size={12} /> View
          </button>
          <a href="#" onClick={async e => { e.preventDefault(); onView(); }}
            className="px-3 py-2 rounded-lg text-xs hover:bg-white/5 transition-colors"
            style={{ color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
            <Download size={12} />
          </a>
        </div>
      ) : (
        <div className="flex gap-2">
          <button onClick={onView}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium hover:opacity-90 transition-opacity"
            style={{ background: meta.bg, color: meta.color }}>
            <ExternalLink size={12} /> Open
          </button>
          <button onClick={copyLink}
            className="px-3 py-2 rounded-lg text-xs hover:bg-white/5 transition-colors"
            style={{ color: copied ? "#22c55e" : "var(--text-secondary)", border: "1px solid var(--border)" }}>
            {copied ? <Check size={12} /> : <Copy size={12} />}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Spreadsheet Card ──────────────────────────────────────────────────────────

function SheetCard({ sheet, folderId, onDelete }: { sheet: Sheet; folderId: string; onDelete: () => void }) {
  const router = useRouter();
  return (
    <div className="group relative flex flex-col gap-3 p-4 rounded-xl border transition-all hover:border-green-500/30 cursor-pointer"
      style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}
      onClick={() => router.push(`/spreadsheet/${sheet.id}`)}>
      <button onClick={e => { e.stopPropagation(); onDelete(); }}
        className="absolute top-3 right-3 p-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>
        <Trash2 size={12} />
      </button>
      <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "#22c55e12" }}>
        <Table2 size={20} style={{ color: "#22c55e" }} />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium truncate pr-6" style={{ color: "var(--text-primary)" }}>{sheet.name}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs px-1.5 py-0.5 rounded-full font-medium" style={{ background: "#22c55e12", color: "#22c55e" }}>Spreadsheet</span>
          <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{sheet.col_headers.length} cols</span>
        </div>
        <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
          {new Date(sheet.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
        </p>
      </div>
      <button className="flex items-center justify-center gap-1.5 w-full py-2 rounded-lg text-xs font-medium hover:opacity-90 transition-opacity"
        style={{ background: "#22c55e12", color: "#22c55e" }}>
        <Table2 size={12} /> Open Spreadsheet
      </button>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function FolderResourcesPage({ params }: { params: Promise<{ folderId: string }> }) {
  const { folderId } = use(params);
  const [folder, setFolder] = useState<{ id: string; name: string } | null>(null);
  const [resources, setResources] = useState<Resource[]>([]);
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [addModal, setAddModal] = useState(false);
  const [viewResource, setViewResource] = useState<Resource | null>(null);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [creatingSheet, setCreatingSheet] = useState(false);
  const router = useRouter();
  const createRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const [resRes, sheetRes] = await Promise.all([
      fetch(`/api/folder-resources?folderId=${folderId}`),
      fetch(`/api/spreadsheets?folderId=${folderId}`),
    ]);
    if (resRes.ok) {
      const d = await resRes.json();
      setFolder(d.folder);
      setResources(d.resources);
    }
    if (sheetRes.ok) setSheets(await sheetRes.json());
    setLoading(false);
  }, [folderId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (createRef.current && !createRef.current.contains(e.target as Node)) setCreateOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  async function createSpreadsheet() {
    setCreatingSheet(true); setCreateOpen(false);
    const res = await fetch("/api/spreadsheets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folderId, name: "Untitled Spreadsheet" }),
    });
    if (res.ok) {
      const d = await res.json();
      router.push(`/spreadsheet/${d.id}`);
    }
    setCreatingSheet(false);
  }

  async function deleteResource(r: Resource) {
    if (!confirm(`Remove "${r.name}"?`)) return;
    setResources(prev => prev.filter(x => x.id !== r.id));
    await fetch("/api/folder-resources", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: r.id, storagePath: r.storage_path }),
    });
  }

  async function deleteSheet(s: Sheet) {
    if (!confirm(`Delete "${s.name}"? All data will be lost.`)) return;
    setSheets(prev => prev.filter(x => x.id !== s.id));
    await fetch("/api/spreadsheets", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: s.id }),
    });
  }

  const totalCount = resources.length + sheets.length;
  const filteredResources = resources.filter(r => !search || r.name.toLowerCase().includes(search.toLowerCase()));
  const filteredSheets = sheets.filter(s => !search || s.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <>
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto p-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: "rgba(124,58,237,0.12)" }}>
              <FolderOpen size={20} style={{ color: "var(--accent-purple)" }} />
            </div>
            <div>
              <h1 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
                {folder?.name ?? "Folder"} — Resources
              </h1>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                {totalCount} item{totalCount !== 1 ? "s" : ""} · shared with the team
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search…"
              className="px-3 py-1.5 rounded-lg text-xs outline-none"
              style={{ background: "var(--bg-secondary)", color: "var(--text-primary)", border: "1px solid var(--border)", width: 160 }} />

            {/* Create dropdown */}
            <div className="relative" ref={createRef}>
              <button onClick={() => setCreateOpen(o => !o)}
                className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-medium hover:bg-white/5 transition-colors"
                style={{ color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
                <Plus size={13} /> Create <ChevronDown size={11} />
              </button>
              {createOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-48 rounded-xl shadow-xl border overflow-hidden z-20"
                  style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
                  <button onClick={createSpreadsheet} disabled={creatingSheet}
                    className="w-full flex items-center gap-2.5 px-4 py-3 text-sm hover:bg-white/5 transition-colors"
                    style={{ color: "var(--text-primary)" }}>
                    <Table2 size={15} style={{ color: "#22c55e" }} />
                    {creatingSheet ? "Creating…" : "New Spreadsheet"}
                  </button>
                  <button onClick={() => { setCreateOpen(false); router.push("/docs"); }}
                    className="w-full flex items-center gap-2.5 px-4 py-3 text-sm hover:bg-white/5 transition-colors border-t"
                    style={{ color: "var(--text-primary)", borderColor: "var(--border)" }}>
                    <FileText size={15} style={{ color: "var(--accent-purple)" }} />
                    New Document
                  </button>
                </div>
              )}
            </div>

            <button onClick={() => setAddModal(true)}
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
        ) : filteredResources.length === 0 && filteredSheets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: "rgba(124,58,237,0.08)" }}>
              <File size={28} style={{ color: "var(--accent-purple)", opacity: 0.6 }} />
            </div>
            <p className="text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
              {search ? "No items match your search" : "No resources yet"}
            </p>
            <p className="text-xs mb-5" style={{ color: "var(--text-secondary)" }}>
              Upload files, add links from Drive/Dropbox/GitHub/Figma, or create a spreadsheet.
            </p>
            {!search && (
              <div className="flex gap-2">
                <button onClick={() => setAddModal(true)}
                  className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90"
                  style={{ background: "var(--accent-purple)" }}>
                  <Plus size={15} /> Add Resource
                </button>
                <button onClick={createSpreadsheet}
                  className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90"
                  style={{ background: "#22c55e12", color: "#22c55e", border: "1px solid #22c55e30" }}>
                  <Table2 size={15} /> New Spreadsheet
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {filteredSheets.map(s => (
              <SheetCard key={s.id} sheet={s} folderId={folderId}
                onDelete={() => deleteSheet(s)} />
            ))}
            {filteredResources.map(r => (
              <ResourceCard key={r.id} resource={r}
                onDelete={() => deleteResource(r)}
                onView={() => setViewResource(r)} />
            ))}
            <button onClick={() => setAddModal(true)}
              className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed min-h-40 hover:border-purple-500/40 transition-colors"
              style={{ borderColor: "var(--border)" }}>
              <Plus size={20} style={{ color: "var(--text-secondary)", opacity: 0.5 }} />
              <span className="text-xs" style={{ color: "var(--text-secondary)" }}>Add resource</span>
            </button>
          </div>
        )}
      </div>
    </div>

    {addModal && (
      <AddResourceModal folderId={folderId} onClose={() => setAddModal(false)}
        onAdded={r => setResources(prev => [r, ...prev])} />
    )}
    {viewResource && (
      <FileViewerModal resource={viewResource} onClose={() => setViewResource(null)} />
    )}
    </>
  );
}
