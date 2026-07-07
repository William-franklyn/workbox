"use client";
import { useEffect, useState, useCallback } from "react";
import {
  Plus, Trash2, GripVertical, Eye, Link, CheckSquare, AlignLeft,
  Hash, Calendar, ChevronDown, Copy, ExternalLink, X, FormInput,
  Loader2, ChevronUp, Sparkles, Share2, Phone, Star, List,
  Download, QrCode, Code2, Type,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type FieldType = "text" | "textarea" | "email" | "phone" | "number" | "select" | "radio" | "checkbox" | "date" | "rating" | "heading";

interface FormField {
  id: string;
  type: FieldType;
  label: string;
  placeholder?: string;
  required: boolean;
  options?: string[];
  maps_to?: "title" | "description" | null;
}

interface WorkboxList { id: string; name: string; space_id?: string; }

interface WorkboxForm {
  id: string;
  name: string;
  description?: string;
  target_list_id?: string;
  target_list?: { id: string; name: string } | null;
  default_status: string;
  default_priority: string;
  fields: FormField[];
  submissions_count: number;
  active: boolean;
  created_at: string;
}

interface Submission {
  id: string;
  form_id: string;
  data: Record<string, unknown>;
  task_id?: string;
  submitter_email?: string;
  created_at: string;
  task?: { id: string; title: string; status: string } | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const FIELD_TYPES: { type: FieldType; label: string; icon: React.ReactNode }[] = [
  { type: "text",     label: "Short text",  icon: <Type size={13} /> },
  { type: "textarea", label: "Long text",   icon: <AlignLeft size={13} /> },
  { type: "email",    label: "Email",       icon: <span className="text-xs font-mono">@</span> },
  { type: "phone",    label: "Phone",       icon: <Phone size={13} /> },
  { type: "number",   label: "Number",      icon: <Hash size={13} /> },
  { type: "date",     label: "Date",        icon: <Calendar size={13} /> },
  { type: "select",   label: "Dropdown",    icon: <ChevronDown size={13} /> },
  { type: "radio",    label: "Multiple choice", icon: <List size={13} /> },
  { type: "checkbox", label: "Checkbox",    icon: <CheckSquare size={13} /> },
  { type: "rating",   label: "Star rating", icon: <Star size={13} /> },
  { type: "heading",  label: "Section heading", icon: <Hash size={13} /> },
];

const STATUS_OPTIONS = ["todo", "in_progress", "in_review", "done"];
const PRIORITY_OPTIONS = ["low", "normal", "high", "urgent"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid() { return `f${Date.now()}${Math.floor(Math.random() * 1000)}`; }

function publicUrl(formId: string) {
  return `${window.location.origin}/f/${formId}`;
}

function exportCSV(form: WorkboxForm, submissions: Submission[]) {
  const dataFields = form.fields.filter(f => f.type !== "heading");
  const headers = ["Date", "Email", ...dataFields.map(f => f.label), "Task"];
  const rows = submissions.map(sub => [
    new Date(sub.created_at).toLocaleString(),
    sub.submitter_email ?? "",
    ...dataFields.map(f => {
      const val = sub.data[f.id];
      return val !== undefined ? String(val) : "";
    }),
    sub.task?.title ?? "",
  ]);
  const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${form.name.replace(/[^a-z0-9]/gi, "_")}_submissions.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Field Row ────────────────────────────────────────────────────────────────

function FieldRow({ field, index, total, onUpdate, onDelete, onMove }: {
  field: FormField; index: number; total: number;
  onUpdate: (id: string, patch: Partial<FormField>) => void;
  onDelete: (id: string) => void;
  onMove: (from: number, to: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const typeInfo = FIELD_TYPES.find(t => t.type === field.type);
  const hasOptions = field.type === "select" || field.type === "radio";
  const isHeading = field.type === "heading";

  return (
    <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--border)", background: "var(--bg-primary)" }}>
      <div className="flex items-center gap-2 px-3 py-2 cursor-pointer select-none" onClick={() => setExpanded(e => !e)}>
        <GripVertical size={14} style={{ color: "var(--text-secondary)" }} className="cursor-grab shrink-0" />
        <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded font-medium shrink-0"
          style={{ background: "rgba(255,255,255,0.08)", color: "var(--text-primary)" }}>
          {typeInfo?.icon}{typeInfo?.label}
        </span>
        <span className="text-sm flex-1 truncate" style={{ color: "var(--text-primary)" }}>
          {field.label || <span style={{ color: "var(--text-secondary)" }}>Untitled field</span>}
        </span>
        {field.required && !isHeading && (
          <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.08)", color: "var(--text-secondary)" }}>Required</span>
        )}
        <button onClick={e => { e.stopPropagation(); onMove(index, index - 1); }} disabled={index === 0}
          className="p-1 rounded hover:bg-white/5 disabled:opacity-30" style={{ color: "var(--text-secondary)" }}>
          <ChevronUp size={12} />
        </button>
        <button onClick={e => { e.stopPropagation(); onMove(index, index + 1); }} disabled={index === total - 1}
          className="p-1 rounded hover:bg-white/5 disabled:opacity-30" style={{ color: "var(--text-secondary)" }}>
          <ChevronDown size={12} />
        </button>
        <button onClick={e => { e.stopPropagation(); onDelete(field.id); }}
          className="p-1 rounded hover:bg-red-500/10" style={{ color: "var(--danger)" }}>
          <Trash2 size={12} />
        </button>
      </div>

      {expanded && (
        <div className="px-3 pb-3 border-t space-y-3" style={{ borderColor: "var(--border)" }} onClick={e => e.stopPropagation()}>
          <div className="pt-3">
            <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>
              {isHeading ? "Heading text" : "Label"}
            </label>
            <input value={field.label} onChange={e => onUpdate(field.id, { label: e.target.value })}
              placeholder={isHeading ? "Section heading..." : "Field label"}
              className="w-full text-sm px-3 py-1.5 rounded-lg border outline-none"
              style={{ background: "var(--bg-secondary)", borderColor: "var(--border)", color: "var(--text-primary)" }} />
          </div>

          {!isHeading && field.type !== "checkbox" && field.type !== "date" && field.type !== "rating" && (
            <div>
              <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>Placeholder</label>
              <input value={field.placeholder ?? ""} onChange={e => onUpdate(field.id, { placeholder: e.target.value })}
                placeholder="Hint text..."
                className="w-full text-sm px-3 py-1.5 rounded-lg border outline-none"
                style={{ background: "var(--bg-secondary)", borderColor: "var(--border)", color: "var(--text-primary)" }} />
            </div>
          )}

          {hasOptions && (
            <div>
              <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>Options (one per line)</label>
              <textarea value={(field.options ?? []).join("\n")}
                onChange={e => onUpdate(field.id, { options: e.target.value.split("\n").filter(Boolean) })}
                placeholder={"Option 1\nOption 2\nOption 3"} rows={4}
                className="w-full text-sm px-3 py-1.5 rounded-lg border outline-none resize-none font-mono"
                style={{ background: "var(--bg-secondary)", borderColor: "var(--border)", color: "var(--text-primary)" }} />
            </div>
          )}

          {!isHeading && (
            <>
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>Maps to task field</label>
                <select value={field.maps_to ?? ""} onChange={e => onUpdate(field.id, { maps_to: (e.target.value as FormField["maps_to"]) || null })}
                  className="text-sm px-3 py-1.5 rounded-lg border outline-none w-full"
                  style={{ background: "var(--bg-secondary)", borderColor: "var(--border)", color: "var(--text-primary)" }}>
                  <option value="">— None —</option>
                  <option value="title">Task title</option>
                  <option value="description">Task description</option>
                </select>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={field.required} onChange={e => onUpdate(field.id, { required: e.target.checked })} className="rounded" />
                <span className="text-sm" style={{ color: "var(--text-primary)" }}>Required</span>
              </label>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Star Rating Display ──────────────────────────────────────────────────────

function StarRating({ value, onChange, disabled }: { value: number; onChange?: (v: number) => void; disabled?: boolean }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(i => (
        <button key={i} type="button" disabled={disabled}
          onClick={() => onChange?.(i)}
          onMouseEnter={() => !disabled && setHover(i)}
          onMouseLeave={() => !disabled && setHover(0)}
          className="p-0.5 transition-colors disabled:cursor-default"
          style={{ color: (hover || value) >= i ? "#f59e0b" : "var(--text-muted)" }}>
          <Star size={20} fill={(hover || value) >= i ? "currentColor" : "none"} />
        </button>
      ))}
    </div>
  );
}

// ─── Form Preview Modal ────────────────────────────────────────────────────────

function FormPreview({ form, onClose }: { form: { name: string; description?: string; fields: FormField[] }; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }}>
      <div className="w-full max-w-lg rounded-2xl border overflow-hidden shadow-2xl"
        style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
          <span className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>Preview</span>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/5" style={{ color: "var(--text-secondary)" }}><X size={16} /></button>
        </div>
        <div className="p-6 max-h-[70vh] overflow-y-auto space-y-5">
          <div>
            <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{form.name || "Untitled Form"}</h2>
            {form.description && <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>{form.description}</p>}
          </div>
          {form.fields.map(field => (
            <div key={field.id}>
              {field.type === "heading" ? (
                <div className="pt-2 pb-1 border-b" style={{ borderColor: "var(--border)" }}>
                  <h3 className="text-sm font-bold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>{field.label || "Section"}</h3>
                </div>
              ) : (
                <>
                  <label className="text-sm font-medium block mb-1.5" style={{ color: "var(--text-primary)" }}>
                    {field.label || "Untitled"}{field.required && <span style={{ color: "#ef4444" }}> *</span>}
                  </label>
                  {field.type === "textarea" && (
                    <textarea disabled placeholder={field.placeholder} rows={3}
                      className="w-full text-sm px-3 py-2 rounded-lg border outline-none resize-none"
                      style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-primary)" }} />
                  )}
                  {field.type === "select" && (
                    <select disabled className="w-full text-sm px-3 py-2 rounded-lg border outline-none"
                      style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-primary)" }}>
                      <option>Select an option...</option>
                      {(field.options ?? []).map(o => <option key={o}>{o}</option>)}
                    </select>
                  )}
                  {field.type === "radio" && (
                    <div className="space-y-2">
                      {(field.options ?? []).map(o => (
                        <label key={o} className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" disabled name={field.id} />
                          <span className="text-sm" style={{ color: "var(--text-primary)" }}>{o}</span>
                        </label>
                      ))}
                    </div>
                  )}
                  {field.type === "checkbox" && (
                    <label className="flex items-center gap-2">
                      <input type="checkbox" disabled />
                      <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{field.placeholder || field.label}</span>
                    </label>
                  )}
                  {field.type === "rating" && <StarRating value={0} disabled />}
                  {(field.type === "text" || field.type === "email" || field.type === "phone" || field.type === "number" || field.type === "date") && (
                    <input type={field.type === "phone" ? "tel" : field.type} disabled placeholder={field.placeholder}
                      className="w-full text-sm px-3 py-2 rounded-lg border outline-none"
                      style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-primary)" }} />
                  )}
                </>
              )}
            </div>
          ))}
          <button disabled className="w-full py-2.5 rounded-lg text-sm font-semibold opacity-70"
            style={{ background: "var(--accent-purple)", color: "#000" }}>
            Submit
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Share Modal ──────────────────────────────────────────────────────────────

function ShareModal({ form, onClose }: { form: WorkboxForm; onClose: () => void }) {
  const url = publicUrl(form.id);
  const embed = `<iframe src="${url}" width="100%" height="600" frameborder="0" style="border:none;border-radius:12px;"></iframe>`;
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}&bgcolor=0e0e0e&color=f0f0f0&format=png&margin=1`;
  const [tab, setTab] = useState<"link" | "qr" | "embed">("link");
  const [copied, setCopied] = useState(false);

  function copy(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.75)" }}>
      <div className="w-full max-w-md rounded-2xl border shadow-2xl overflow-hidden"
        style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
          <span className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>Share — {form.name}</span>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/5" style={{ color: "var(--text-secondary)" }}><X size={16} /></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b" style={{ borderColor: "var(--border)" }}>
          {(["link", "qr", "embed"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="flex-1 py-2.5 text-xs font-medium capitalize transition-colors"
              style={{
                color: tab === t ? "var(--text-primary)" : "var(--text-secondary)",
                borderBottom: tab === t ? "2px solid var(--accent-purple)" : "2px solid transparent",
              }}>
              {t === "link" ? <span className="flex items-center justify-center gap-1.5"><Link size={12} /> Link</span>
                : t === "qr" ? <span className="flex items-center justify-center gap-1.5"><QrCode size={12} /> QR Code</span>
                : <span className="flex items-center justify-center gap-1.5"><Code2 size={12} /> Embed</span>}
            </button>
          ))}
        </div>

        <div className="p-5">
          {tab === "link" && (
            <div className="space-y-4">
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>Share this link with anyone to let them fill out your form.</p>
              <div className="flex items-center gap-2 p-3 rounded-lg border" style={{ borderColor: "var(--border)", background: "var(--bg-primary)" }}>
                <span className="text-xs flex-1 truncate font-mono" style={{ color: "var(--text-secondary)" }}>{url}</span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => copy(url)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors"
                  style={{ background: copied ? "rgba(34,197,94,0.15)" : "var(--bg-surface)", color: copied ? "#22c55e" : "var(--text-primary)", border: "1px solid var(--border)" }}>
                  <Copy size={13} />{copied ? "Copied!" : "Copy link"}
                </button>
                <a href={url} target="_blank" rel="noreferrer"
                  className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium"
                  style={{ background: "var(--accent-purple)", color: "#000", border: "1px solid transparent" }}>
                  <ExternalLink size={13} /> Open
                </a>
              </div>
            </div>
          )}

          {tab === "qr" && (
            <div className="space-y-4 text-center">
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>Scan to open the form on any device.</p>
              <div className="flex justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrSrc} alt="Form QR code" width={180} height={180}
                  className="rounded-xl" style={{ border: "4px solid var(--bg-primary)" }} />
              </div>
              <a href={qrSrc} download={`${form.name.replace(/[^a-z0-9]/gi, "_")}_qr.png`}
                target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium"
                style={{ background: "var(--bg-surface)", color: "var(--text-primary)", border: "1px solid var(--border)" }}>
                <Download size={13} /> Download QR
              </a>
            </div>
          )}

          {tab === "embed" && (
            <div className="space-y-4">
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>Paste this snippet into any webpage to embed the form.</p>
              <div className="p-3 rounded-lg border overflow-x-auto" style={{ borderColor: "var(--border)", background: "var(--bg-primary)" }}>
                <pre className="text-xs font-mono whitespace-pre-wrap break-all" style={{ color: "var(--text-secondary)" }}>{embed}</pre>
              </div>
              <button onClick={() => copy(embed)}
                className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{ background: copied ? "rgba(34,197,94,0.15)" : "var(--bg-surface)", color: copied ? "#22c55e" : "var(--text-primary)", border: "1px solid var(--border)" }}>
                <Copy size={13} />{copied ? "Copied!" : "Copy embed code"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Responses Modal ──────────────────────────────────────────────────────────

function ResponsesModal({ form, onClose }: { form: WorkboxForm; onClose: () => void }) {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/forms/${form.id}/submissions`)
      .then(r => r.json())
      .then(d => setSubmissions(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
  }, [form.id]);

  const dataFields = form.fields.filter(f => f.type !== "heading");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }}>
      <div className="w-full max-w-5xl rounded-2xl border shadow-2xl flex flex-col"
        style={{ background: "var(--bg-secondary)", borderColor: "var(--border)", maxHeight: "85vh" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0" style={{ borderColor: "var(--border)" }}>
          <div>
            <span className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>Responses — {form.name}</span>
            <span className="ml-2 text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--bg-surface)", color: "var(--text-secondary)" }}>
              {form.submissions_count} submission{form.submissions_count !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {submissions.length > 0 && (
              <button onClick={() => exportCSV(form, submissions)}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors hover:opacity-80"
                style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
                <Download size={12} /> Export CSV
              </button>
            )}
            <button onClick={onClose} className="p-1 rounded hover:bg-white/5" style={{ color: "var(--text-secondary)" }}><X size={16} /></button>
          </div>
        </div>

        <div className="overflow-auto flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={20} className="animate-spin" style={{ color: "var(--text-secondary)" }} />
            </div>
          ) : submissions.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-4xl mb-3">📭</div>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>No submissions yet</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b" style={{ borderColor: "var(--border)" }}>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>Date</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>Email</th>
                  {dataFields.map(f => (
                    <th key={f.id} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide whitespace-nowrap max-w-[160px] truncate" style={{ color: "var(--text-secondary)" }}>
                      {f.label}
                    </th>
                  ))}
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>Task</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map(sub => (
                  <tr key={sub.id} className="border-b hover:bg-white/2 transition-colors" style={{ borderColor: "var(--border)" }}>
                    <td className="px-4 py-3 whitespace-nowrap text-xs" style={{ color: "var(--text-secondary)" }}>
                      {new Date(sub.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: "var(--text-primary)" }}>{sub.submitter_email ?? "—"}</td>
                    {dataFields.map(f => {
                      const val = sub.data[f.id];
                      const display = val !== undefined ? String(val) : "—";
                      return (
                        <td key={f.id} className="px-4 py-3 max-w-[160px] truncate text-xs" style={{ color: "var(--text-primary)" }}>
                          {f.type === "rating" && val ? (
                            <span className="flex items-center gap-0.5">
                              {"★".repeat(Number(val))}{"☆".repeat(5 - Number(val))}
                              <span className="ml-1 text-xs" style={{ color: "var(--text-secondary)" }}>{val}/5</span>
                            </span>
                          ) : display}
                        </td>
                      );
                    })}
                    <td className="px-4 py-3">
                      {sub.task ? (
                        <span className="text-xs px-2 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.08)", color: "var(--text-primary)" }}>
                          {sub.task.title}
                        </span>
                      ) : <span style={{ color: "var(--text-secondary)" }}>—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── AI Generate Panel ────────────────────────────────────────────────────────

function AIGeneratePanel({ onGenerated }: {
  onGenerated: (name: string, desc: string, fields: FormField[]) => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    if (!prompt.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/form", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: prompt }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "AI error"); return; }
      const fields: FormField[] = (data.fields ?? []).map((f: Record<string, unknown>) => ({
        id: uid(),
        type: (f.type as FieldType) ?? "text",
        label: String(f.label ?? ""),
        placeholder: f.placeholder ? String(f.placeholder) : "",
        required: Boolean(f.required),
        options: Array.isArray(f.options) ? f.options.map(String) : undefined,
        maps_to: (f.maps_to as FormField["maps_to"]) ?? null,
      }));
      onGenerated(String(data.name ?? prompt), String(data.description ?? ""), fields);
    } catch {
      setError("Failed to generate form");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border p-4 space-y-3"
      style={{ borderColor: "rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.04)" }}>
      <div className="flex items-center gap-2">
        <Sparkles size={14} style={{ color: "var(--text-primary)" }} />
        <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>Generate with AI</span>
      </div>
      <textarea value={prompt} onChange={e => setPrompt(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) generate(); }}
        placeholder="Describe your form — e.g. 'bug report form' or 'customer feedback survey with rating and suggestions'..."
        rows={2}
        className="w-full text-sm px-3 py-2 rounded-lg border outline-none resize-none"
        style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-primary)" }} />
      {error && <p className="text-xs" style={{ color: "var(--danger)" }}>{error}</p>}
      <button onClick={generate} disabled={loading || !prompt.trim()}
        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-opacity disabled:opacity-50"
        style={{ background: "var(--accent-purple)", color: "#000" }}>
        {loading ? <><Loader2 size={12} className="animate-spin" /> Generating…</> : <><Sparkles size={12} /> Generate fields</>}
      </button>
    </div>
  );
}

// ─── Create/Edit Modal ────────────────────────────────────────────────────────

function FormModal({ initial, lists, onSave, onClose }: {
  initial?: WorkboxForm | null;
  lists: WorkboxList[];
  onSave: (form: WorkboxForm) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [targetListId, setTargetListId] = useState(initial?.target_list_id ?? "");
  const [defaultStatus, setDefaultStatus] = useState(initial?.default_status ?? "todo");
  const [defaultPriority, setDefaultPriority] = useState(initial?.default_priority ?? "normal");
  const [fields, setFields] = useState<FormField[]>(initial?.fields ?? []);
  const [showTypeMenu, setShowTypeMenu] = useState(false);
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addField(type: FieldType) {
    const hasOpts = type === "select" || type === "radio";
    setFields(fs => [...fs, {
      id: uid(), type, label: "", placeholder: "", required: false,
      options: hasOpts ? ["Option 1", "Option 2"] : undefined, maps_to: null,
    }]);
    setShowTypeMenu(false);
  }

  function updateField(id: string, patch: Partial<FormField>) {
    setFields(fs => fs.map(f => f.id === id ? { ...f, ...patch } : f));
  }

  function deleteField(id: string) { setFields(fs => fs.filter(f => f.id !== id)); }

  function moveField(from: number, to: number) {
    if (to < 0 || to >= fields.length) return;
    const next = [...fields];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    setFields(next);
  }

  function handleAIGenerated(aiName: string, aiDesc: string, aiFields: FormField[]) {
    if (!name) setName(aiName);
    if (!description) setDescription(aiDesc);
    setFields(aiFields);
  }

  async function handleSave() {
    if (!name.trim()) { setError("Form name is required"); return; }
    setSaving(true);
    setError(null);
    try {
      const body = initial
        ? { id: initial.id, name, description, target_list_id: targetListId || null, fields, default_status: defaultStatus, default_priority: defaultPriority }
        : { name, description, target_list_id: targetListId || null, fields, default_status: defaultStatus, default_priority: defaultPriority };
      const res = await fetch("/api/forms", {
        method: initial ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error ?? "Failed to save"); return; }
      const saved = await res.json();
      onSave(saved);
    } catch {
      setError("Failed to save form");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {preview && <FormPreview form={{ name, description, fields }} onClose={() => setPreview(false)} />}
      <div className="fixed inset-0 z-40 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }}>
        <div className="w-full max-w-2xl rounded-2xl border shadow-2xl flex flex-col"
          style={{ background: "var(--bg-secondary)", borderColor: "var(--border)", maxHeight: "90vh" }}>
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b shrink-0" style={{ borderColor: "var(--border)" }}>
            <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{initial ? "Edit form" : "Create form"}</span>
            <div className="flex items-center gap-2">
              <button onClick={() => setPreview(true)}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border"
                style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
                <Eye size={13} /> Preview
              </button>
              <button onClick={onClose} className="p-1 rounded hover:bg-white/5" style={{ color: "var(--text-secondary)" }}><X size={16} /></button>
            </div>
          </div>

          {/* Body */}
          <div className="overflow-y-auto flex-1 p-5 space-y-5">
            {error && (
              <div className="text-sm px-3 py-2 rounded-lg" style={{ background: "rgba(255,255,255,0.06)", color: "var(--danger)" }}>{error}</div>
            )}

            {/* AI Generation */}
            {!initial && <AIGeneratePanel onGenerated={handleAIGenerated} />}

            {/* Basic info */}
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>Form name *</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Bug Report"
                  className="w-full text-sm px-3 py-2 rounded-lg border outline-none"
                  style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-primary)" }} />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>Description</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)}
                  placeholder="Tell submitters what this form is for..." rows={2}
                  className="w-full text-sm px-3 py-2 rounded-lg border outline-none resize-none"
                  style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-primary)" }} />
              </div>
            </div>

            {/* Task settings */}
            <div className="rounded-xl border p-4 space-y-3" style={{ borderColor: "var(--border)", background: "var(--bg-primary)" }}>
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>Task settings</p>
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>Target list</label>
                <select value={targetListId} onChange={e => setTargetListId(e.target.value)}
                  className="w-full text-sm px-3 py-2 rounded-lg border outline-none"
                  style={{ background: "var(--bg-secondary)", borderColor: "var(--border)", color: "var(--text-primary)" }}>
                  <option value="">— No target list —</option>
                  {lists.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>Default status</label>
                  <select value={defaultStatus} onChange={e => setDefaultStatus(e.target.value)}
                    className="w-full text-sm px-3 py-2 rounded-lg border outline-none"
                    style={{ background: "var(--bg-secondary)", borderColor: "var(--border)", color: "var(--text-primary)" }}>
                    {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>Default priority</label>
                  <select value={defaultPriority} onChange={e => setDefaultPriority(e.target.value)}
                    className="w-full text-sm px-3 py-2 rounded-lg border outline-none"
                    style={{ background: "var(--bg-secondary)", borderColor: "var(--border)", color: "var(--text-primary)" }}>
                    {PRIORITY_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Field builder */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: "var(--text-secondary)" }}>
                Fields ({fields.length})
              </p>
              <div className="space-y-2">
                {fields.map((field, idx) => (
                  <FieldRow key={field.id} field={field} index={idx} total={fields.length}
                    onUpdate={updateField} onDelete={deleteField} onMove={moveField} />
                ))}
              </div>

              <div className="relative mt-3">
                <button onClick={() => setShowTypeMenu(v => !v)}
                  className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border w-full justify-center hover:opacity-80 transition-opacity"
                  style={{ borderColor: "var(--border)", color: "var(--text-secondary)", borderStyle: "dashed" }}>
                  <Plus size={14} /> Add field
                </button>
                {showTypeMenu && (
                  <div className="absolute top-full left-0 right-0 mt-1 rounded-xl border shadow-xl z-10 overflow-hidden"
                    style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}>
                    <div className="grid grid-cols-2 gap-1 p-2">
                      {FIELD_TYPES.map(({ type, label, icon }) => (
                        <button key={type} onClick={() => addField(type)}
                          className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg text-left hover:bg-white/5"
                          style={{ color: "var(--text-primary)" }}>
                          <span style={{ color: "var(--text-secondary)" }}>{icon}</span>{label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-5 py-4 border-t shrink-0" style={{ borderColor: "var(--border)" }}>
            <button onClick={onClose} className="text-sm px-4 py-2 rounded-lg" style={{ color: "var(--text-secondary)" }}>Cancel</button>
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg font-medium disabled:opacity-60"
              style={{ background: "var(--accent-purple)", color: "#000" }}>
              {saving && <Loader2 size={13} className="animate-spin" />}
              {initial ? "Save changes" : "Create form"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Form Card ────────────────────────────────────────────────────────────────

function FormCard({ form, onEdit, onDelete, onToggleActive, onViewResponses, onShare }: {
  form: WorkboxForm;
  onEdit: () => void;
  onDelete: () => void;
  onToggleActive: () => void;
  onViewResponses: () => void;
  onShare: () => void;
}) {
  return (
    <div className="rounded-xl border p-4 flex flex-col gap-3 transition-colors hover:border-white/20"
      style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-semibold text-sm truncate" style={{ color: "var(--text-primary)" }}>{form.name}</h3>
          {form.description && (
            <p className="text-xs mt-0.5 line-clamp-2" style={{ color: "var(--text-secondary)" }}>{form.description}</p>
          )}
        </div>
        <button onClick={onToggleActive}
          className="shrink-0 text-xs px-2 py-0.5 rounded-full font-medium transition-colors"
          style={{
            background: form.active ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.05)",
            color: form.active ? "var(--text-primary)" : "var(--text-secondary)",
          }}>
          {form.active ? "Active" : "Inactive"}
        </button>
      </div>

      <div className="flex items-center gap-3 text-xs" style={{ color: "var(--text-secondary)" }}>
        <span>
          <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{form.submissions_count}</span> submissions
        </span>
        {form.target_list && <span className="truncate">→ {form.target_list.name}</span>}
        <span>{form.fields.length} fields</span>
      </div>

      <div className="flex items-center gap-1 flex-wrap">
        <button onClick={onShare}
          className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border transition-colors hover:opacity-80"
          style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
          <Share2 size={11} /> Share
        </button>
        <a href={`/f/${form.id}`} target="_blank" rel="noreferrer"
          className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border"
          style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
          <ExternalLink size={11} /> Open
        </a>
        <button onClick={onViewResponses}
          className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border"
          style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
          <Eye size={11} /> Responses
          {form.submissions_count > 0 && (
            <span className="ml-0.5 px-1 rounded-full text-xs" style={{ background: "rgba(255,255,255,0.12)", color: "var(--text-primary)" }}>
              {form.submissions_count}
            </span>
          )}
        </button>
        <button onClick={onEdit}
          className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border"
          style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
          <FormInput size={11} /> Edit
        </button>
        <button onClick={onDelete}
          className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border ml-auto"
          style={{ borderColor: "rgba(255,255,255,0.1)", color: "var(--danger)" }}>
          <Trash2 size={11} />
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function FormsPage() {
  const [forms, setForms] = useState<WorkboxForm[]>([]);
  const [lists, setLists] = useState<WorkboxList[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingForm, setEditingForm] = useState<WorkboxForm | null>(null);
  const [responsesForm, setResponsesForm] = useState<WorkboxForm | null>(null);
  const [sharingForm, setSharingForm] = useState<WorkboxForm | null>(null);

  const loadForms = useCallback(() => {
    fetch("/api/forms")
      .then(r => r.json())
      .then(d => setForms(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadForms();
    fetch("/api/workspace")
      .then(r => r.json())
      .then(d => setLists(Array.isArray(d.lists) ? d.lists : []));
  }, [loadForms]);

  function handleSaved(saved: WorkboxForm) {
    setForms(fs => {
      const idx = fs.findIndex(f => f.id === saved.id);
      if (idx >= 0) { const next = [...fs]; next[idx] = saved; return next; }
      return [saved, ...fs];
    });
    setShowModal(false);
    setEditingForm(null);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this form? All submissions will also be deleted.")) return;
    setForms(fs => fs.filter(f => f.id !== id));
    await fetch(`/api/forms?id=${encodeURIComponent(id)}`, { method: "DELETE" });
  }

  async function handleToggleActive(form: WorkboxForm) {
    const updated = { ...form, active: !form.active };
    setForms(fs => fs.map(f => f.id === form.id ? updated : f));
    await fetch("/api/forms", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: form.id, active: !form.active }),
    });
  }

  return (
    <>
      {showModal && (
        <FormModal initial={editingForm} lists={lists} onSave={handleSaved}
          onClose={() => { setShowModal(false); setEditingForm(null); }} />
      )}
      {responsesForm && <ResponsesModal form={responsesForm} onClose={() => setResponsesForm(null)} />}
      {sharingForm && <ShareModal form={sharingForm} onClose={() => setSharingForm(null)} />}

      <div className="p-6 max-w-5xl mx-auto overflow-y-auto h-full">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Forms</h1>
            <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
              Collect requests — each submission becomes a task automatically
            </p>
          </div>
          <button onClick={() => { setEditingForm(null); setShowModal(true); }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-90"
            style={{ background: "var(--accent-purple)", color: "#000" }}>
            <Plus size={14} /> Create Form
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 size={22} className="animate-spin" style={{ color: "var(--text-secondary)" }} />
          </div>
        ) : forms.length === 0 ? (
          <div className="rounded-2xl border text-center py-20" style={{ borderColor: "var(--border)", borderStyle: "dashed" }}>
            <div className="text-5xl mb-4">📋</div>
            <h2 className="text-lg font-semibold mb-2" style={{ color: "var(--text-primary)" }}>No forms yet</h2>
            <p className="text-sm mb-6 max-w-sm mx-auto" style={{ color: "var(--text-secondary)" }}>
              Build forms with AI in seconds — bug reports, feature requests, intake forms, surveys. Every submission creates a task in WorkBox.
            </p>
            <button onClick={() => { setEditingForm(null); setShowModal(true); }}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold"
              style={{ background: "var(--accent-purple)", color: "#000" }}>
              <Sparkles size={15} /> Create your first form
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {forms.map(form => (
              <FormCard key={form.id} form={form}
                onEdit={() => { setEditingForm(form); setShowModal(true); }}
                onDelete={() => handleDelete(form.id)}
                onToggleActive={() => handleToggleActive(form)}
                onViewResponses={() => setResponsesForm(form)}
                onShare={() => setSharingForm(form)} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
