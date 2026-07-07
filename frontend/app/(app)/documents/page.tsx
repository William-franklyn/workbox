"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, Search, FolderOpen, FileText, X, Loader2, Trash2, Edit3,
  Grid3X3, List, Share2, ChevronRight, ArrowLeft, Eye, Save,
  LayoutTemplate, Copy, Check, Link2, Lock, Table2, Upload,
  ListOrdered, Code, Minus, Undo2, Redo2,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface OrgDocument {
  id: string; name: string; description?: string; content?: string;
  folder?: string; file_type?: string; status?: string; tags: string[];
  version?: number; author_name?: string; expires_at?: string;
  share_token?: string; share_access?: string;
  created_at: string; updated_at: string;
}

// ─── Document templates ───────────────────────────────────────────────────────

const D = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

const TEMPLATES = [
  { id: "meeting", name: "Meeting Notes", icon: "📋", description: "Structured notes for team meetings",
    content: `# Meeting Notes\n\n**Date:** ${D}\n**Attendees:** \n**Facilitator:** \n\n## Agenda\n\n1. \n2. \n3. \n\n## Discussion\n\n### Item 1\n\n\n## Action Items\n\n- [ ] Task — Owner — Due date\n- [ ] Task — Owner — Due date\n\n## Next Meeting\n\n**Date:** \n**Topics:** ` },
  { id: "brief", name: "Project Brief", icon: "🚀", description: "Project overview and objectives",
    content: `# Project Brief\n\n**Project:** \n**Owner:** \n**Date:** ${D}\n\n## Overview\n\n\n## Objectives\n\n1. \n2. \n3. \n\n## Scope\n\n**In scope:**\n- \n\n**Out of scope:**\n- \n\n## Timeline\n\n| Phase | Start | End | Owner |\n|---|---|---|---|\n| Planning | | | |\n| Execution | | | |\n\n## Risks\n\n| Risk | Impact | Mitigation |\n|---|---|---|\n| | | |` },
  { id: "report", name: "Business Report", icon: "📊", description: "Quarterly or annual report",
    content: `# Business Report\n\n**Period:** \n**Prepared by:** \n**Date:** ${D}\n\n## Executive Summary\n\n\n## Key Metrics\n\n| Metric | This Period | Last Period | Change |\n|---|---|---|---|\n| | | | |\n\n## Highlights\n\n- \n- \n\n## Analysis\n\n\n## Recommendations\n\n1. \n2. \n\n## Conclusion\n` },
  { id: "policy", name: "Company Policy", icon: "📜", description: "HR or operational policy document",
    content: `# [Policy Name]\n\n**Effective Date:** \n**Version:** 1.0\n**Owner:** \n\n## Purpose\n\n\n## Scope\n\nThis policy applies to all employees of [Company Name].\n\n## Policy Statement\n\n\n## Responsibilities\n\n- **Management:** \n- **Employees:** \n\n## Procedure\n\n1. \n2. \n3. \n\n## Compliance\n\nViolations of this policy may result in disciplinary action.\n\n## Review Schedule\n\nThis policy will be reviewed annually.` },
  { id: "nda", name: "NDA Template", icon: "🔒", description: "Non-disclosure agreement",
    content: `# Non-Disclosure Agreement\n\n**Date:** ${D}\n**Disclosing Party:** \n**Receiving Party:** \n\n## 1. Confidential Information\n\nFor purposes of this Agreement, "Confidential Information" means any non-public information disclosed by one party to the other.\n\n## 2. Obligations\n\nThe receiving party agrees to:\n- Keep all Confidential Information strictly confidential\n- Not disclose to any third party without prior written consent\n- Use only for the stated purpose\n\n## 3. Duration\n\nThis Agreement remains in effect for **[X] years** from the date of signing.\n\n## 4. Exclusions\n\nDoes not apply to information that is publicly available or independently developed.\n\n---\n\n**Disclosing Party:** ___________________  Date: ________\n\n**Receiving Party:** ___________________  Date: ________` },
  { id: "proposal", name: "Proposal", icon: "💼", description: "Business or project proposal",
    content: `# Proposal\n\n**Prepared for:** \n**Prepared by:** \n**Date:** ${D}\n\n## Introduction\n\n\n## Problem Statement\n\n\n## Proposed Solution\n\n\n## Deliverables\n\n- \n- \n\n## Timeline\n\n| Milestone | Delivery Date |\n|---|---|\n| Phase 1 | |\n| Phase 2 | |\n\n## Investment\n\n| Item | Cost |\n|---|---|\n| | |\n| **Total** | |\n\n## Next Steps\n\nTo proceed, please sign and return this proposal by [date].` },
  { id: "spec", name: "Product Spec", icon: "⚙️", description: "Technical or product specification",
    content: `# Product Specification\n\n**Product:** \n**Version:** 1.0\n**Author:** \n**Date:** ${D}\n\n## Overview\n\n\n## Goals\n\n- \n\n## Non-Goals\n\n- \n\n## User Stories\n\n- As a **[user]**, I want to **[action]** so that **[benefit]**\n\n## Requirements\n\n| # | Requirement | Priority |\n|---|---|---|\n| 1 | | High |\n\n## Technical Design\n\n\n## Open Questions\n\n- [ ] \n- [ ] ` },
  { id: "onboarding", name: "Onboarding Guide", icon: "👋", description: "New employee onboarding checklist",
    content: `# Welcome to [Company]!\n\n**Employee:** \n**Start date:** \n**Department:** \n**Manager:** \n\n## First Day\n\n- [ ] Complete HR paperwork\n- [ ] Collect equipment and access cards\n- [ ] Meet your direct team\n- [ ] Set up email and key accounts\n\n## First Week\n\n- [ ] Review company handbook\n- [ ] Complete security & compliance training\n- [ ] 1:1 with manager\n- [ ] Shadow team members\n\n## First 30 Days\n\n- [ ] Complete all onboarding modules\n- [ ] Contribute to first project task\n- [ ] 30-day check-in with manager\n\n## Key Contacts\n\n| Name | Role | Contact |\n|---|---|---|\n| | HR | |\n| | IT Helpdesk | |` },
];

// ─── Markdown renderer ────────────────────────────────────────────────────────

function renderMarkdown(text: string): string {
  return text
    .replace(/^### (.+)$/gm, "<h3 class='doc-h3'>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2 class='doc-h2'>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1 class='doc-h1'>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code class='doc-code'>$1</code>")
    .replace(/^- \[x\] (.+)$/gm, "<div class='doc-check'>✅ <span>$1</span></div>")
    .replace(/^- \[ \] (.+)$/gm, "<div class='doc-check'>☐ <span>$1</span></div>")
    .replace(/^- (.+)$/gm, "<div class='doc-li'>· <span>$1</span></div>")
    .replace(/^\|(.+)\|$/gm, (_, row: string) => {
      if (/^[-| ]+$/.test(row)) return "";
      const cells = row.split("|").map((c: string) => `<td class='doc-td'>${c.trim()}</td>`).join("");
      return `<tr>${cells}</tr>`;
    })
    .replace(/(<tr>[\s\S]*?<\/tr>(\n|$))+/g, m => `<table class='doc-table'>${m}</table>`)
    .replace(/---+/g, "<hr class='doc-hr' />")
    .replace(/\n\n+/g, "</p><p class='doc-p'>")
    .replace(/^(?!<[htdpcb])(.+)$/gm, "<p class='doc-p'>$1</p>");
}

// ─── File type icon ───────────────────────────────────────────────────────────

function FileIcon({ type, size = 32 }: { type?: string; size?: number }) {
  const t = (type ?? "document").toLowerCase();
  const emoji = t.includes("pdf") ? "📕" : t.includes("sheet") || t.includes("xls") || t.includes("csv") ? "📗" : t.includes("ppt") ? "📙" : t.includes("image") || t.includes("png") || t.includes("jpg") ? "🖼️" : "📄";
  return <div style={{ fontSize: size * 0.6, width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center" }}>{emoji}</div>;
}

// ─── Template picker ──────────────────────────────────────────────────────────

const FILE_TYPES = [
  { id: "document", icon: <FileText size={22} />, label: "Document", description: "Rich text, markdown, reports, policies" },
  { id: "spreadsheet", icon: <Table2 size={22} />, label: "Spreadsheet", description: "Tables, budgets, trackers, data grids" },
  { id: "import", icon: <Upload size={22} />, label: "Import file", description: "Upload PDF, Word, Excel, CSV, and more" },
];

function TemplatePicker({ onPick, onBlank, onClose, onSpreadsheet, onImport }: {
  onPick: (t: typeof TEMPLATES[0]) => void;
  onBlank: () => void;
  onClose: () => void;
  onSpreadsheet: () => void;
  onImport: (file: File) => void;
}) {
  const [step, setStep] = useState<"type" | "templates">("type");
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.8)" }}>
      <div className="w-full max-w-3xl rounded-2xl border shadow-2xl flex flex-col max-h-[85vh]"
        style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-3">
            {step === "templates" && (
              <button onClick={() => setStep("type")} className="p-1 rounded-lg hover:bg-white/5" style={{ color: "var(--text-secondary)" }}>
                <ArrowLeft size={15} />
              </button>
            )}
            <div>
              <p className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>
                {step === "type" ? "Create new" : "Document templates"}
              </p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                {step === "type" ? "Choose what you'd like to create" : "Start from a template or blank"}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5" style={{ color: "var(--text-secondary)" }}><X size={16} /></button>
        </div>

        <div className="overflow-y-auto flex-1 p-5">
          {step === "type" ? (
            /* File type selection */
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {FILE_TYPES.map(ft => (
                <button key={ft.id}
                  onClick={() => {
                    if (ft.id === "document") setStep("templates");
                    else if (ft.id === "spreadsheet") onSpreadsheet();
                    else fileRef.current?.click();
                  }}
                  className="flex flex-col items-start gap-3 p-5 rounded-xl border text-left hover:border-white/25 transition-colors"
                  style={{ background: "var(--bg-primary)", borderColor: "var(--border)" }}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-primary)" }}>
                    {ft.icon}
                  </div>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{ft.label}</p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>{ft.description}</p>
                  </div>
                </button>
              ))}
              {/* Hidden file input for import */}
              <input ref={fileRef} type="file" className="hidden"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.md,.ppt,.pptx"
                onChange={e => { const f = e.target.files?.[0]; if (f) { onClose(); onImport(f); } }} />
            </div>
          ) : (
            /* Document templates */
            <>
              <button onClick={onBlank}
                className="w-full mb-4 flex items-center gap-3 p-4 rounded-xl border text-left hover:border-white/30 transition-colors"
                style={{ background: "var(--bg-primary)", borderColor: "var(--border)" }}>
                <div className="w-10 h-10 rounded-xl border-2 border-dashed flex items-center justify-center" style={{ borderColor: "var(--border-strong)" }}>
                  <Plus size={18} style={{ color: "var(--text-muted)" }} />
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Blank document</p>
                  <p className="text-xs" style={{ color: "var(--text-secondary)" }}>Start from scratch</p>
                </div>
              </button>
              <p className="text-xs font-medium mb-3" style={{ color: "var(--text-muted)" }}>TEMPLATES</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {TEMPLATES.map(t => (
                  <button key={t.id} onClick={() => onPick(t)}
                    className="flex flex-col items-start gap-2 p-4 rounded-xl border text-left hover:border-white/30 transition-colors"
                    style={{ background: "var(--bg-primary)", borderColor: "var(--border)" }}>
                    <span className="text-2xl">{t.icon}</span>
                    <div>
                      <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{t.name}</p>
                      <p className="text-xs mt-0.5 line-clamp-2" style={{ color: "var(--text-muted)" }}>{t.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Share modal ──────────────────────────────────────────────────────────────

function ShareModal({ doc, onClose, onUpdate }: { doc: OrgDocument; onClose: () => void; onUpdate: (d: Partial<OrgDocument>) => void }) {
  const [sharing, setSharing] = useState(!!doc.share_token && doc.share_access !== "none");
  const [access, setAccess] = useState<"view" | "edit">(doc.share_access === "edit" ? "edit" : "view");
  const [token, setToken] = useState(doc.share_token ?? "");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const shareUrl = token ? `${window.location.origin}/share/${token}` : "";

  async function toggle(on: boolean) {
    setLoading(true);
    const res = await fetch("/api/documents/share", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: doc.id, access: on ? access : "none" }),
    });
    const data = await res.json();
    setSharing(on);
    if (on) setToken(data.share_token ?? "");
    else setToken("");
    onUpdate({ share_token: data.share_token, share_access: data.share_access });
    setLoading(false);
  }

  async function changeAccess(a: "view" | "edit") {
    setAccess(a);
    if (!sharing) return;
    setLoading(true);
    const res = await fetch("/api/documents/share", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: doc.id, access: a }),
    });
    const data = await res.json();
    onUpdate({ share_token: data.share_token, share_access: data.share_access });
    setLoading(false);
  }

  function copy() {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.75)" }}>
      <div className="w-full max-w-md rounded-2xl border shadow-2xl" style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
          <div>
            <p className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>Share document</p>
            <p className="text-xs mt-0.5 truncate max-w-xs" style={{ color: "var(--text-secondary)" }}>{doc.name}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5" style={{ color: "var(--text-secondary)" }}><X size={15} /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Link sharing</p>
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>Anyone with the link can access</p>
            </div>
            <button onClick={() => toggle(!sharing)} disabled={loading}
              className="w-11 h-6 rounded-full relative transition-colors disabled:opacity-50"
              style={{ background: sharing ? "var(--accent-purple)" : "var(--bg-primary)", border: "1px solid var(--border)" }}>
              <span className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all" style={{ left: sharing ? "calc(100% - 22px)" : 2 }} />
            </button>
          </div>

          {/* Access level */}
          {sharing && (
            <div>
              <p className="text-xs font-medium mb-2" style={{ color: "var(--text-secondary)" }}>ACCESS LEVEL</p>
              <div className="flex gap-2">
                {(["view", "edit"] as const).map(a => (
                  <button key={a} onClick={() => changeAccess(a)} disabled={loading}
                    className="flex-1 flex items-center gap-2 p-3 rounded-xl border text-sm capitalize transition-colors disabled:opacity-50"
                    style={{
                      background: access === a ? "rgba(255,255,255,0.08)" : "var(--bg-primary)",
                      borderColor: access === a ? "rgba(255,255,255,0.3)" : "var(--border)",
                      color: "var(--text-primary)",
                    }}>
                    {a === "view" ? <Eye size={14} /> : <Edit3 size={14} />}
                    {a === "view" ? "View only" : "Can edit"}
                  </button>
                ))}
              </div>
              <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
                {access === "view" ? "Viewers can read the document but not make changes." : "Anyone with the link can read and edit the document."}
              </p>
            </div>
          )}

          {/* Link */}
          {sharing && token && (
            <div>
              <p className="text-xs font-medium mb-2" style={{ color: "var(--text-secondary)" }}>SHARE LINK</p>
              <div className="flex items-center gap-2 p-2.5 rounded-xl border" style={{ background: "var(--bg-primary)", borderColor: "var(--border)" }}>
                <Link2 size={13} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                <p className="text-xs flex-1 truncate" style={{ color: "var(--text-secondary)" }}>{shareUrl}</p>
                <button onClick={copy} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium flex-shrink-0 transition-colors"
                  style={{ background: copied ? "rgba(255,255,255,0.1)" : "var(--accent-purple)", color: copied ? "var(--text-primary)" : "#000" }}>
                  {copied ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy</>}
                </button>
              </div>
              <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
                Recipients will be prompted to create a WorkBox account after a few seconds.
              </p>
            </div>
          )}

          {!sharing && (
            <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "var(--bg-primary)" }}>
              <Lock size={14} style={{ color: "var(--text-muted)" }} />
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>Only you can access this document. Enable link sharing to share with others.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Document editor ──────────────────────────────────────────────────────────

function DocEditor({ doc, onClose, onSave }: { doc: OrgDocument; onClose: () => void; onSave: (d: OrgDocument) => void }) {
  const [name, setName] = useState(doc.name);
  const [content, setContent] = useState(doc.content ?? "");
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const autoRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  function markDirty(val: string, field: "name" | "content") {
    setDirty(true);
    if (field === "content") setContent(val);
    else setName(val);
    if (autoRef.current) clearTimeout(autoRef.current);
    autoRef.current = setTimeout(() => autosave(field === "name" ? val : name, field === "content" ? val : content), 2000);
  }

  async function autosave(n: string, c: string) {
    await fetch("/api/documents", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: doc.id, name: n, content: c, updated_at: new Date().toISOString() }),
    });
    setDirty(false);
  }

  async function save() {
    if (autoRef.current) clearTimeout(autoRef.current);
    setSaving(true);
    const res = await fetch("/api/documents", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: doc.id, name, content, updated_at: new Date().toISOString() }),
    });
    const d = await res.json();
    setSaving(false);
    setDirty(false);
    onSave(d);
  }

  // ── Formatting helpers ─────────────────────────────────────────────────────

  function applyInline(prefix: string, suffix = prefix) {
    const ta = taRef.current;
    if (!ta) return;
    const { selectionStart: s, selectionEnd: e } = ta;
    const sel = content.slice(s, e);
    const next = content.slice(0, s) + prefix + sel + suffix + content.slice(e);
    markDirty(next, "content");
    setTimeout(() => {
      ta.focus();
      ta.selectionStart = s + prefix.length;
      ta.selectionEnd = e + prefix.length;
    }, 0);
  }

  function applyLinePrefix(prefix: string) {
    const ta = taRef.current;
    if (!ta) return;
    const { selectionStart: s, selectionEnd: e } = ta;
    const lines = content.split("\n");
    let pos = 0;
    const newLines = lines.map(line => {
      const start = pos;
      const end = pos + line.length;
      pos += line.length + 1;
      if (end >= s && start <= e) {
        return line.startsWith(prefix) ? line.slice(prefix.length) : prefix + line;
      }
      return line;
    });
    markDirty(newLines.join("\n"), "content");
    setTimeout(() => ta.focus(), 0);
  }

  function insertAtCursor(text: string) {
    const ta = taRef.current;
    if (!ta) return;
    const { selectionStart: s, selectionEnd: e } = ta;
    const next = content.slice(0, s) + text + content.slice(e);
    markDirty(next, "content");
    setTimeout(() => {
      ta.focus();
      ta.selectionStart = ta.selectionEnd = s + text.length;
    }, 0);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    const ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && e.key === "b") { e.preventDefault(); applyInline("**"); }
    if (ctrl && e.key === "i") { e.preventDefault(); applyInline("*"); }
    if (ctrl && e.key === "s") { e.preventDefault(); save(); }
    if (ctrl && e.key === "k") { e.preventDefault(); applyInline("[", "](url)"); }
  }

  // ── Toolbar button component ───────────────────────────────────────────────
  function Btn({ title, onClick, children, mono = false }: { title: string; onClick: () => void; children: React.ReactNode; mono?: boolean }) {
    return (
      <button
        onMouseDown={e => { e.preventDefault(); onClick(); }}
        title={title}
        className="h-7 min-w-7 px-1 flex items-center justify-center rounded transition-colors hover:bg-white/10"
        style={{ color: "var(--text-secondary)", fontSize: mono ? 12 : undefined, fontWeight: mono ? 700 : undefined, fontFamily: mono ? "ui-monospace,monospace" : undefined }}
      >
        {children}
      </button>
    );
  }

  function Sep() {
    return <div className="w-px h-4 mx-1 flex-shrink-0" style={{ background: "var(--border)" }} />;
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col" style={{ background: "var(--bg-primary)" }}>
      {/* Top bar */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b shrink-0" style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}>
        <button onClick={onClose} className="flex items-center gap-1.5 text-sm px-2 py-1.5 rounded-lg hover:bg-white/5 shrink-0" style={{ color: "var(--text-secondary)" }}>
          <ArrowLeft size={14} /> Back
        </button>
        <div className="w-px h-4 mx-1 shrink-0" style={{ background: "var(--border)" }} />
        <input
          value={name}
          onChange={e => markDirty(e.target.value, "name")}
          className="flex-1 bg-transparent outline-none text-sm font-semibold min-w-0"
          style={{ color: "var(--text-primary)" }}
          placeholder="Document title"
        />
        <div className="flex items-center gap-2 shrink-0">
          {dirty && <span className="text-xs hidden sm:block" style={{ color: "var(--text-muted)" }}>Unsaved</span>}
          <button onClick={() => setPreview(p => !p)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border"
            style={{ borderColor: "var(--border)", color: preview ? "var(--text-primary)" : "var(--text-secondary)", background: preview ? "rgba(255,255,255,0.08)" : "transparent" }}>
            <Eye size={12} /> {preview ? "Edit" : "Preview"}
          </button>
          <button onClick={save} disabled={saving}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium disabled:opacity-60"
            style={{ background: "var(--accent-purple)", color: "#000" }}>
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Save
          </button>
        </div>
      </div>

      {/* Formatting toolbar */}
      {!preview && (
        <div className="flex items-center gap-0.5 px-3 py-1.5 border-b flex-wrap shrink-0"
          style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}>
          {/* Text style */}
          <Btn title="Bold (Ctrl+B)" onClick={() => applyInline("**")} mono><strong>B</strong></Btn>
          <Btn title="Italic (Ctrl+I)" onClick={() => applyInline("*")} mono><em style={{ fontStyle: "italic" }}>I</em></Btn>
          <Btn title="Strikethrough" onClick={() => applyInline("~~")} mono><span style={{ textDecoration: "line-through" }}>S</span></Btn>
          <Btn title="Underline" onClick={() => applyInline("<u>", "</u>")} mono><span style={{ textDecoration: "underline" }}>U</span></Btn>
          <Sep />
          {/* Headings */}
          <Btn title="Heading 1" onClick={() => applyLinePrefix("# ")} mono>H1</Btn>
          <Btn title="Heading 2" onClick={() => applyLinePrefix("## ")} mono>H2</Btn>
          <Btn title="Heading 3" onClick={() => applyLinePrefix("### ")} mono>H3</Btn>
          <Sep />
          {/* Lists */}
          <Btn title="Bullet list" onClick={() => applyLinePrefix("- ")}><List size={13} /></Btn>
          <Btn title="Numbered list" onClick={() => applyLinePrefix("1. ")}><ListOrdered size={13} /></Btn>
          <Btn title="Checklist" onClick={() => applyLinePrefix("- [ ] ")} mono>☑</Btn>
          <Btn title="Blockquote" onClick={() => applyLinePrefix("> ")} mono>&quot;</Btn>
          <Sep />
          {/* Code */}
          <Btn title="Inline code" onClick={() => applyInline("`")}><Code size={13} /></Btn>
          <Btn title="Code block" onClick={() => insertAtCursor("\n```\n\n```\n")} mono>{"</>"}</Btn>
          <Sep />
          {/* Insert */}
          <Btn title="Link (Ctrl+K)" onClick={() => applyInline("[", "](url)")}><Link2 size={13} /></Btn>
          <Btn title="Table" onClick={() => insertAtCursor("\n| Column 1 | Column 2 | Column 3 |\n|---|---|---|\n| Cell | Cell | Cell |\n")}><Table2 size={13} /></Btn>
          <Btn title="Horizontal rule" onClick={() => insertAtCursor("\n---\n")}><Minus size={13} /></Btn>
          <Sep />
          {/* Undo/Redo */}
          <Btn title="Undo (Ctrl+Z)" onClick={() => { taRef.current?.focus(); document.execCommand("undo"); }}><Undo2 size={13} /></Btn>
          <Btn title="Redo (Ctrl+Y)" onClick={() => { taRef.current?.focus(); document.execCommand("redo"); }}><Redo2 size={13} /></Btn>
        </div>
      )}

      {/* Editor body */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-8">
          {preview ? (
            <div className="doc-preview" dangerouslySetInnerHTML={{ __html: renderMarkdown(content || "*Nothing to preview yet.*") }} />
          ) : (
            <textarea
              ref={taRef}
              value={content}
              onChange={e => markDirty(e.target.value, "content")}
              onKeyDown={handleKeyDown}
              placeholder="Start writing… Use the toolbar above or Markdown syntax"
              className="w-full resize-none bg-transparent outline-none text-sm leading-7"
              style={{ color: "var(--text-primary)", minHeight: "calc(100vh - 200px)" }}
              spellCheck
            />
          )}
        </div>
      </div>

      <style>{`
        .doc-preview h1 { font-size:1.7rem;font-weight:800;margin:0 0 .5em;color:var(--text-primary) }
        .doc-preview h2 { font-size:1.3rem;font-weight:700;margin:1.4em 0 .4em;color:var(--text-primary) }
        .doc-preview h3 { font-size:1.05rem;font-weight:600;margin:1.1em 0 .3em;color:var(--text-primary) }
        .doc-preview p  { margin:.5em 0;line-height:1.75;color:var(--text-primary) }
        .doc-preview strong { font-weight:700 }
        .doc-preview em { font-style:italic;opacity:.85 }
        .doc-preview u { text-decoration:underline }
        .doc-preview del { text-decoration:line-through;opacity:.7 }
        .doc-preview code { background:rgba(255,255,255,0.08);padding:2px 6px;border-radius:4px;font-size:.85em;font-family:ui-monospace,monospace }
        .doc-preview pre { background:rgba(255,255,255,0.05);padding:12px 16px;border-radius:8px;overflow-x:auto;margin:1em 0 }
        .doc-preview pre code { background:none;padding:0 }
        .doc-preview blockquote { border-left:3px solid var(--accent-purple);padding-left:12px;margin:1em 0;opacity:.8;font-style:italic }
        .doc-preview hr { border:none;border-top:1px solid var(--border);margin:1.5em 0 }
        .doc-preview ul { padding-left:1.5em;margin:.5em 0 }
        .doc-preview ol { padding-left:1.5em;margin:.5em 0 }
        .doc-preview li { margin:.25em 0;color:var(--text-primary) }
        .doc-preview table { border-collapse:collapse;width:100%;margin:1em 0 }
        .doc-preview th { padding:8px 12px;text-align:left;font-weight:600;border-bottom:2px solid var(--border);font-size:.9em;color:var(--text-primary) }
        .doc-preview td { padding:6px 12px;border-bottom:1px solid var(--border);font-size:.9em;color:var(--text-primary) }
        .doc-preview a { color:var(--accent-purple);text-decoration:underline }
      `}</style>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

const FOLDERS = ["General", "Policies", "Contracts", "Reports", "Legal", "Finance", "HR", "Operations"];

export default function DocumentsPage() {
  const router = useRouter();
  const [docs, setDocs] = useState<OrgDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [folder, setFolder] = useState("all");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [editorDoc, setEditorDoc] = useState<OrgDocument | null>(null);
  const [shareDoc, setShareDoc] = useState<OrgDocument | null>(null);
  const [templateOpen, setTemplateOpen] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    const p = new URLSearchParams();
    if (folder !== "all") p.set("folder", folder);
    if (search) p.set("search", search);
    fetch(`/api/documents?${p}`).then(r => r.json()).then(d => setDocs(Array.isArray(d) ? d : [])).finally(() => setLoading(false));
  }, [folder, search]);

  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  async function createDoc(name: string, content: string, tplFolder = "General") {
    const res = await fetch("/api/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, content, folder: tplFolder, status: "draft", tags: [], file_type: "document" }),
    });
    const d = await res.json();
    setDocs(prev => [d, ...prev]);
    setEditorDoc(d);
  }

  async function importFile(file: File) {
    let content = "";
    const name = file.name.replace(/\.[^.]+$/, "");

    if (/\.(xlsx|xls)$/i.test(file.name)) {
      const XLSX = await import("xlsx");
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const parts: string[] = [];
      for (const sheetName of wb.SheetNames) {
        const ws = wb.Sheets[sheetName];
        const rows: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
        if (!rows.length) continue;
        parts.push(`## ${sheetName}\n`);
        const colWidths = rows[0].map((_, ci) => Math.max(...rows.map(r => String(r[ci] ?? "").length), 3));
        const fmtRow = (r: string[]) => "| " + r.map((cell, ci) => String(cell ?? "").padEnd(colWidths[ci])).join(" | ") + " |";
        const sep = "| " + colWidths.map(w => "-".repeat(w)).join(" | ") + " |";
        parts.push(fmtRow(rows[0]));
        parts.push(sep);
        for (const row of rows.slice(1)) {
          const padded = Array.from({ length: rows[0].length }, (_, i) => String(row[i] ?? ""));
          parts.push(fmtRow(padded));
        }
      }
      content = parts.join("\n");
    } else if (/\.(txt|md|csv)$/i.test(file.name)) {
      content = await file.text();
    } else {
      content = `*Imported file: ${file.name}*\n\n> This file type cannot be rendered as text.`;
    }

    await createDoc(name, content);
  }

  async function deleteDoc(id: string) {
    if (!confirm("Delete this document?")) return;
    setDocs(p => p.filter(d => d.id !== id));
    await fetch(`/api/documents?id=${id}`, { method: "DELETE" });
  }

  function updateDoc(updated: OrgDocument) {
    setDocs(p => p.map(d => d.id === updated.id ? updated : d));
  }

  function updateDocPartial(id: string, patch: Partial<OrgDocument>) {
    setDocs(p => p.map(d => d.id === id ? { ...d, ...patch } : d));
  }

  const allFolders = Array.from(new Set([...FOLDERS, ...docs.map(d => d.folder).filter(Boolean)])) as string[];
  const filtered = docs;

  // Show editor if open
  if (editorDoc) {
    return (
      <DocEditor
        doc={editorDoc}
        onClose={() => { setEditorDoc(null); load(); }}
        onSave={d => { updateDoc(d); setEditorDoc(d); }}
      />
    );
  }

  return (
    <>
      {templateOpen && (
        <TemplatePicker
          onBlank={() => { setTemplateOpen(false); createDoc("Untitled Document", ""); }}
          onPick={t => { setTemplateOpen(false); createDoc(t.name, t.content); }}
          onClose={() => setTemplateOpen(false)}
          onSpreadsheet={() => { setTemplateOpen(false); router.push("/spreadsheets"); }}
          onImport={file => { importFile(file); }}
        />
      )}
      {shareDoc && (
        <ShareModal
          doc={shareDoc}
          onClose={() => setShareDoc(null)}
          onUpdate={patch => { updateDocPartial(shareDoc.id, patch); setShareDoc(d => d ? { ...d, ...patch } : d); }}
        />
      )}

      <div className="flex h-full overflow-hidden">
        {/* Sidebar */}
        <div className="w-48 shrink-0 border-r flex flex-col overflow-hidden hidden sm:flex"
          style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}>
          <div className="p-3 border-b" style={{ borderColor: "var(--border)" }}>
            <div className="flex items-center gap-2 px-2 py-1">
              <FileText size={14} style={{ color: "var(--text-primary)" }} />
              <span className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>My Drive</span>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
            <button onClick={() => setFolder("all")}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-left transition-colors"
              style={{ background: folder === "all" ? "var(--bg-active)" : "transparent", color: folder === "all" ? "var(--text-primary)" : "var(--text-secondary)" }}>
              <Grid3X3 size={12} /> All files
              <span className="ml-auto text-xs" style={{ color: "var(--text-muted)" }}>{docs.length}</span>
            </button>
            <div className="px-3 pt-3 pb-1">
              <p className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>FOLDERS</p>
            </div>
            {allFolders.map(f => (
              <button key={f} onClick={() => setFolder(f)}
                className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-left transition-colors"
                style={{ background: folder === f ? "var(--bg-active)" : "transparent", color: folder === f ? "var(--text-primary)" : "var(--text-secondary)" }}>
                <FolderOpen size={12} /> {f}
                <span className="ml-auto" style={{ color: "var(--text-muted)" }}>
                  {docs.filter(d => d.folder === f).length || ""}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Main */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Toolbar */}
          <div className="flex items-center gap-2 px-4 py-3 border-b shrink-0" style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}>
            {/* Breadcrumb */}
            <div className="flex items-center gap-1.5 text-sm flex-1 min-w-0">
              <button onClick={() => setFolder("all")} className="font-semibold hover:underline" style={{ color: "var(--text-primary)" }}>My Drive</button>
              {folder !== "all" && (
                <>
                  <ChevronRight size={12} style={{ color: "var(--text-muted)" }} />
                  <span style={{ color: "var(--text-secondary)" }}>{folder}</span>
                </>
              )}
            </div>

            {/* Search */}
            <div className="relative hidden sm:block">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
                className="text-xs pl-8 pr-3 py-1.5 rounded-lg border outline-none w-44"
                style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-primary)" }} />
            </div>

            {/* View toggle */}
            <div className="flex rounded-lg border overflow-hidden" style={{ borderColor: "var(--border)" }}>
              {(["grid", "list"] as const).map(v => (
                <button key={v} onClick={() => setView(v)}
                  className="p-1.5"
                  style={{ background: view === v ? "rgba(255,255,255,0.1)" : "transparent", color: view === v ? "var(--text-primary)" : "var(--text-muted)" }}>
                  {v === "grid" ? <Grid3X3 size={13} /> : <List size={13} />}
                </button>
              ))}
            </div>

            {/* New button */}
            <button onClick={() => setTemplateOpen(true)}
              className="flex items-center gap-1.5 text-sm px-4 py-1.5 rounded-lg font-semibold"
              style={{ background: "var(--accent-purple)", color: "#000" }}>
              <Plus size={14} /> New
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-5">
            {loading ? (
              <div className="flex justify-center py-20"><Loader2 size={22} className="animate-spin" style={{ color: "var(--text-secondary)" }} /></div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-20">
                <div className="text-5xl mb-4">📂</div>
                <p className="text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>No documents yet</p>
                <p className="text-xs mb-4" style={{ color: "var(--text-secondary)" }}>Create your first document from a template or blank</p>
                <button onClick={() => setTemplateOpen(true)}
                  className="inline-flex items-center gap-2 text-sm px-4 py-2 rounded-xl font-medium"
                  style={{ background: "var(--accent-purple)", color: "#000" }}>
                  <LayoutTemplate size={14} /> Browse templates
                </button>
              </div>
            ) : view === "grid" ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {filtered.map(d => (
                  <div key={d.id} onClick={() => setEditorDoc(d)}
                    className="rounded-xl border flex flex-col cursor-pointer hover:border-white/30 transition-all hover:-translate-y-0.5 group relative overflow-hidden"
                    style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
                    {/* Thumbnail area */}
                    <div className="h-28 flex items-center justify-center border-b" style={{ background: "var(--bg-primary)", borderColor: "var(--border)" }}>
                      <FileIcon type={d.file_type} size={48} />
                    </div>
                    {/* Info */}
                    <div className="p-2.5">
                      <p className="text-xs font-semibold line-clamp-2 mb-1" style={{ color: "var(--text-primary)" }}>{d.name}</p>
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                        {new Date(d.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </p>
                    </div>
                    {/* Hover actions */}
                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={e => { e.stopPropagation(); setShareDoc(d); }}
                        className="w-6 h-6 rounded-md flex items-center justify-center"
                        style={{ background: "var(--bg-secondary)", color: "var(--text-secondary)" }}>
                        <Share2 size={11} />
                      </button>
                      <button onClick={e => { e.stopPropagation(); deleteDoc(d.id); }}
                        className="w-6 h-6 rounded-md flex items-center justify-center"
                        style={{ background: "var(--bg-secondary)", color: "var(--danger)" }}>
                        <Trash2 size={11} />
                      </button>
                    </div>
                    {d.share_access && d.share_access !== "none" && (
                      <div className="absolute bottom-2 right-2">
                        <Share2 size={9} style={{ color: "var(--accent-purple)" }} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-1">
                <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                  <span className="col-span-6">Name</span>
                  <span className="col-span-2">Folder</span>
                  <span className="col-span-2">Owner</span>
                  <span className="col-span-2">Modified</span>
                </div>
                {filtered.map(d => (
                  <div key={d.id} onClick={() => setEditorDoc(d)}
                    className="grid grid-cols-12 gap-2 items-center px-3 py-2.5 rounded-xl cursor-pointer hover:bg-white/5 group transition-colors"
                    style={{ borderBottom: "1px solid var(--border)" }}>
                    <div className="col-span-6 flex items-center gap-2.5 min-w-0">
                      <FileIcon type={d.file_type} size={20} />
                      <span className="text-sm truncate font-medium" style={{ color: "var(--text-primary)" }}>{d.name}</span>
                      {d.share_access && d.share_access !== "none" && <Share2 size={10} style={{ color: "var(--accent-purple)", flexShrink: 0 }} />}
                    </div>
                    <span className="col-span-2 text-xs truncate" style={{ color: "var(--text-secondary)" }}>{d.folder ?? "—"}</span>
                    <span className="col-span-2 text-xs truncate" style={{ color: "var(--text-secondary)" }}>{d.author_name ?? "—"}</span>
                    <div className="col-span-2 flex items-center justify-between">
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                        {new Date(d.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={e => { e.stopPropagation(); setShareDoc(d); }} className="p-1 rounded hover:bg-white/10" style={{ color: "var(--text-secondary)" }}><Share2 size={12} /></button>
                        <button onClick={e => { e.stopPropagation(); deleteDoc(d.id); }} className="p-1 rounded hover:bg-red-500/10" style={{ color: "var(--danger)" }}><Trash2 size={12} /></button>
                      </div>
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
