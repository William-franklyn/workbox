"use client";
import { useEffect, useState, useCallback } from "react";
import {
  Plus,
  Trash2,
  GripVertical,
  Eye,
  Link,
  CheckSquare,
  AlignLeft,
  Hash,
  Calendar,
  ChevronDown,
  Copy,
  ExternalLink,
  X,
  FormInput,
  Loader2,
  ChevronUp,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type FieldType = "text" | "textarea" | "email" | "number" | "select" | "checkbox" | "date";

interface FormField {
  id: string;
  type: FieldType;
  label: string;
  placeholder?: string;
  required: boolean;
  options?: string[];
  maps_to?: "title" | "description" | null;
}

interface WorkboxList {
  id: string;
  name: string;
  space_id?: string;
}

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
  { type: "text",     label: "Text",       icon: <FormInput size={14} /> },
  { type: "textarea", label: "Long text",  icon: <AlignLeft size={14} /> },
  { type: "email",    label: "Email",      icon: <span className="text-xs font-mono">@</span> },
  { type: "number",   label: "Number",     icon: <Hash size={14} /> },
  { type: "select",   label: "Dropdown",   icon: <ChevronDown size={14} /> },
  { type: "checkbox", label: "Checkbox",   icon: <CheckSquare size={14} /> },
  { type: "date",     label: "Date",       icon: <Calendar size={14} /> },
];

const STATUS_OPTIONS = ["todo", "in_progress", "in_review", "done"];
const PRIORITY_OPTIONS = ["low", "normal", "high", "urgent"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid() {
  return `f${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

function publicUrl(formId: string) {
  return `${window.location.origin}/f/${formId}`;
}

// ─── Field Row ────────────────────────────────────────────────────────────────

function FieldRow({
  field,
  index,
  total,
  onUpdate,
  onDelete,
  onMove,
}: {
  field: FormField;
  index: number;
  total: number;
  onUpdate: (id: string, patch: Partial<FormField>) => void;
  onDelete: (id: string) => void;
  onMove: (from: number, to: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const typeInfo = FIELD_TYPES.find((t) => t.type === field.type);

  return (
    <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--border)", background: "var(--bg-primary)" }}>
      {/* Header row */}
      <div
        className="flex items-center gap-2 px-3 py-2 cursor-pointer select-none"
        onClick={() => setExpanded((e) => !e)}
      >
        <GripVertical size={14} style={{ color: "var(--text-secondary)" }} className="cursor-grab shrink-0" />

        {/* Type badge */}
        <span
          className="flex items-center gap-1 text-xs px-2 py-0.5 rounded font-medium shrink-0"
          style={{ background: "rgba(124,58,237,0.15)", color: "var(--accent-purple)" }}
        >
          {typeInfo?.icon}
          {typeInfo?.label}
        </span>

        <span className="text-sm flex-1 truncate" style={{ color: "var(--text-primary)" }}>
          {field.label || <span style={{ color: "var(--text-secondary)" }}>Untitled field</span>}
        </span>

        {field.required && (
          <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444" }}>
            Required
          </span>
        )}

        {/* Move up/down */}
        <button
          onClick={(e) => { e.stopPropagation(); onMove(index, index - 1); }}
          disabled={index === 0}
          className="p-1 rounded hover:bg-white/5 disabled:opacity-30"
          style={{ color: "var(--text-secondary)" }}
        >
          <ChevronUp size={12} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onMove(index, index + 1); }}
          disabled={index === total - 1}
          className="p-1 rounded hover:bg-white/5 disabled:opacity-30"
          style={{ color: "var(--text-secondary)" }}
        >
          <ChevronDown size={12} />
        </button>

        <button
          onClick={(e) => { e.stopPropagation(); onDelete(field.id); }}
          className="p-1 rounded hover:bg-red-500/10"
          style={{ color: "var(--danger)" }}
        >
          <Trash2 size={12} />
        </button>
      </div>

      {/* Expanded editor */}
      {expanded && (
        <div
          className="px-3 pb-3 border-t space-y-3"
          style={{ borderColor: "var(--border)" }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Label */}
          <div className="pt-3">
            <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>Label</label>
            <input
              value={field.label}
              onChange={(e) => onUpdate(field.id, { label: e.target.value })}
              placeholder="Field label"
              className="w-full text-sm px-3 py-1.5 rounded-lg border outline-none"
              style={{ background: "var(--bg-secondary)", borderColor: "var(--border)", color: "var(--text-primary)" }}
            />
          </div>

          {/* Placeholder */}
          {field.type !== "checkbox" && field.type !== "date" && (
            <div>
              <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>Placeholder</label>
              <input
                value={field.placeholder ?? ""}
                onChange={(e) => onUpdate(field.id, { placeholder: e.target.value })}
                placeholder="Hint text..."
                className="w-full text-sm px-3 py-1.5 rounded-lg border outline-none"
                style={{ background: "var(--bg-secondary)", borderColor: "var(--border)", color: "var(--text-primary)" }}
              />
            </div>
          )}

          {/* Options (select type) */}
          {field.type === "select" && (
            <div>
              <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>Options (one per line)</label>
              <textarea
                value={(field.options ?? []).join("\n")}
                onChange={(e) => onUpdate(field.id, { options: e.target.value.split("\n").filter(Boolean) })}
                placeholder={"Option 1\nOption 2\nOption 3"}
                rows={4}
                className="w-full text-sm px-3 py-1.5 rounded-lg border outline-none resize-none font-mono"
                style={{ background: "var(--bg-secondary)", borderColor: "var(--border)", color: "var(--text-primary)" }}
              />
            </div>
          )}

          {/* Maps to */}
          <div>
            <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>Maps to task field</label>
            <select
              value={field.maps_to ?? ""}
              onChange={(e) => onUpdate(field.id, { maps_to: (e.target.value as FormField["maps_to"]) || null })}
              className="text-sm px-3 py-1.5 rounded-lg border outline-none w-full"
              style={{ background: "var(--bg-secondary)", borderColor: "var(--border)", color: "var(--text-primary)" }}
            >
              <option value="">— None —</option>
              <option value="title">Task title</option>
              <option value="description">Task description</option>
            </select>
          </div>

          {/* Required toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={field.required}
              onChange={(e) => onUpdate(field.id, { required: e.target.checked })}
              className="rounded"
            />
            <span className="text-sm" style={{ color: "var(--text-primary)" }}>Required</span>
          </label>
        </div>
      )}
    </div>
  );
}

// ─── Form Preview Modal ────────────────────────────────────────────────────────

function FormPreview({ form, onClose }: { form: { name: string; description?: string; fields: FormField[] }; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }}>
      <div
        className="w-full max-w-lg rounded-2xl border overflow-hidden shadow-2xl"
        style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
          <span className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>Preview</span>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/5" style={{ color: "var(--text-secondary)" }}>
            <X size={16} />
          </button>
        </div>
        <div className="p-6 max-h-[70vh] overflow-y-auto space-y-5">
          <div>
            <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{form.name || "Untitled Form"}</h2>
            {form.description && <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>{form.description}</p>}
          </div>
          {form.fields.map((field) => (
            <div key={field.id}>
              <label className="text-sm font-medium block mb-1" style={{ color: "var(--text-primary)" }}>
                {field.label || "Untitled"}
                {field.required && <span style={{ color: "#ef4444" }}> *</span>}
              </label>
              {field.type === "textarea" && (
                <textarea
                  disabled
                  placeholder={field.placeholder}
                  rows={3}
                  className="w-full text-sm px-3 py-2 rounded-lg border outline-none resize-none"
                  style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                />
              )}
              {field.type === "select" && (
                <select
                  disabled
                  className="w-full text-sm px-3 py-2 rounded-lg border outline-none"
                  style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                >
                  <option>Select an option...</option>
                  {(field.options ?? []).map((o) => <option key={o}>{o}</option>)}
                </select>
              )}
              {field.type === "checkbox" && (
                <label className="flex items-center gap-2">
                  <input type="checkbox" disabled />
                  <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{field.placeholder || field.label}</span>
                </label>
              )}
              {(field.type === "text" || field.type === "email" || field.type === "number" || field.type === "date") && (
                <input
                  type={field.type}
                  disabled
                  placeholder={field.placeholder}
                  className="w-full text-sm px-3 py-2 rounded-lg border outline-none"
                  style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                />
              )}
            </div>
          ))}
          <button
            disabled
            className="w-full py-2.5 rounded-lg text-sm font-semibold text-white opacity-70"
            style={{ background: "var(--accent-purple)" }}
          >
            Submit
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Responses Modal ──────────────────────────────────────────────────────────

function ResponsesModal({
  form,
  onClose,
}: {
  form: WorkboxForm;
  onClose: () => void;
}) {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/forms/${form.id}/submissions`)
      .then((r) => r.json())
      .then((d) => setSubmissions(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
  }, [form.id]);

  const fields = form.fields;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }}>
      <div
        className="w-full max-w-4xl rounded-2xl border shadow-2xl flex flex-col"
        style={{ background: "var(--bg-secondary)", borderColor: "var(--border)", maxHeight: "80vh" }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0" style={{ borderColor: "var(--border)" }}>
          <div>
            <span className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>Responses — {form.name}</span>
            <span className="ml-2 text-xs" style={{ color: "var(--text-secondary)" }}>{form.submissions_count} submission{form.submissions_count !== 1 ? "s" : ""}</span>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/5" style={{ color: "var(--text-secondary)" }}>
            <X size={16} />
          </button>
        </div>

        <div className="overflow-auto flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={20} className="animate-spin" style={{ color: "var(--text-secondary)" }} />
            </div>
          ) : submissions.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>No submissions yet</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b" style={{ borderColor: "var(--border)" }}>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
                    Date
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
                    Email
                  </th>
                  {fields.slice(0, 3).map((f) => (
                    <th key={f.id} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide truncate max-w-[150px]" style={{ color: "var(--text-secondary)" }}>
                      {f.label}
                    </th>
                  ))}
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
                    Task
                  </th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((sub) => (
                  <tr key={sub.id} className="border-b hover:bg-white/2" style={{ borderColor: "var(--border)" }}>
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
                      {new Date(sub.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3" style={{ color: "var(--text-primary)" }}>
                      {sub.submitter_email ?? "—"}
                    </td>
                    {fields.slice(0, 3).map((f) => (
                      <td key={f.id} className="px-4 py-3 max-w-[150px] truncate" style={{ color: "var(--text-primary)" }}>
                        {sub.data[f.id] !== undefined ? String(sub.data[f.id]) : "—"}
                      </td>
                    ))}
                    <td className="px-4 py-3">
                      {sub.task ? (
                        <span className="text-xs px-2 py-0.5 rounded" style={{ background: "rgba(124,58,237,0.15)", color: "var(--accent-purple)" }}>
                          {sub.task.title}
                        </span>
                      ) : (
                        <span style={{ color: "var(--text-secondary)" }}>—</span>
                      )}
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

// ─── Create/Edit Modal ────────────────────────────────────────────────────────

function FormModal({
  initial,
  lists,
  onSave,
  onClose,
}: {
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
    setFields((fs) => [
      ...fs,
      { id: uid(), type, label: "", placeholder: "", required: false, options: type === "select" ? ["Option 1"] : undefined, maps_to: null },
    ]);
    setShowTypeMenu(false);
  }

  function updateField(id: string, patch: Partial<FormField>) {
    setFields((fs) => fs.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }

  function deleteField(id: string) {
    setFields((fs) => fs.filter((f) => f.id !== id));
  }

  function moveField(from: number, to: number) {
    if (to < 0 || to >= fields.length) return;
    const next = [...fields];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    setFields(next);
  }

  async function handleSave() {
    if (!name.trim()) { setError("Form name is required"); return; }
    setSaving(true);
    setError(null);
    try {
      const method = initial ? "PATCH" : "POST";
      const body = initial
        ? { id: initial.id, name, description, target_list_id: targetListId || null, fields, default_status: defaultStatus, default_priority: defaultPriority }
        : { name, description, target_list_id: targetListId || null, fields, default_status: defaultStatus, default_priority: defaultPriority };
      const res = await fetch("/api/forms", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Failed to save");
        return;
      }
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
      {preview && (
        <FormPreview form={{ name, description, fields }} onClose={() => setPreview(false)} />
      )}
      <div className="fixed inset-0 z-40 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }}>
        <div
          className="w-full max-w-2xl rounded-2xl border shadow-2xl flex flex-col"
          style={{ background: "var(--bg-secondary)", borderColor: "var(--border)", maxHeight: "90vh" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b shrink-0" style={{ borderColor: "var(--border)" }}>
            <span className="font-semibold" style={{ color: "var(--text-primary)" }}>
              {initial ? "Edit form" : "Create form"}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPreview(true)}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border"
                style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
              >
                <Eye size={13} /> Preview
              </button>
              <button onClick={onClose} className="p-1 rounded hover:bg-white/5" style={{ color: "var(--text-secondary)" }}>
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="overflow-y-auto flex-1 p-5 space-y-5">
            {error && (
              <div className="text-sm px-3 py-2 rounded-lg" style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444" }}>
                {error}
              </div>
            )}

            {/* Basic info */}
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>Form name *</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Bug Report"
                  className="w-full text-sm px-3 py-2 rounded-lg border outline-none"
                  style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Tell submitters what this form is for..."
                  rows={2}
                  className="w-full text-sm px-3 py-2 rounded-lg border outline-none resize-none"
                  style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                />
              </div>
            </div>

            {/* Task settings */}
            <div className="rounded-xl border p-4 space-y-3" style={{ borderColor: "var(--border)", background: "var(--bg-primary)" }}>
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>Task settings</p>
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>Target list</label>
                <select
                  value={targetListId}
                  onChange={(e) => setTargetListId(e.target.value)}
                  className="w-full text-sm px-3 py-2 rounded-lg border outline-none"
                  style={{ background: "var(--bg-secondary)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                >
                  <option value="">— No target list —</option>
                  {lists.map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>Default status</label>
                  <select
                    value={defaultStatus}
                    onChange={(e) => setDefaultStatus(e.target.value)}
                    className="w-full text-sm px-3 py-2 rounded-lg border outline-none"
                    style={{ background: "var(--bg-secondary)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                  >
                    {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>Default priority</label>
                  <select
                    value={defaultPriority}
                    onChange={(e) => setDefaultPriority(e.target.value)}
                    className="w-full text-sm px-3 py-2 rounded-lg border outline-none"
                    style={{ background: "var(--bg-secondary)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                  >
                    {PRIORITY_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
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
                  <FieldRow
                    key={field.id}
                    field={field}
                    index={idx}
                    total={fields.length}
                    onUpdate={updateField}
                    onDelete={deleteField}
                    onMove={moveField}
                  />
                ))}
              </div>

              {/* Add field */}
              <div className="relative mt-3">
                <button
                  onClick={() => setShowTypeMenu((v) => !v)}
                  className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border w-full justify-center hover:opacity-80 transition-opacity"
                  style={{ borderColor: "var(--border)", color: "var(--text-secondary)", borderStyle: "dashed" }}
                >
                  <Plus size={14} /> Add field
                </button>
                {showTypeMenu && (
                  <div
                    className="absolute top-full left-0 right-0 mt-1 rounded-xl border shadow-xl z-10 overflow-hidden"
                    style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}
                  >
                    <div className="grid grid-cols-2 gap-1 p-2">
                      {FIELD_TYPES.map(({ type, label, icon }) => (
                        <button
                          key={type}
                          onClick={() => addField(type)}
                          className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg text-left hover:bg-white/5"
                          style={{ color: "var(--text-primary)" }}
                        >
                          <span style={{ color: "var(--accent-purple)" }}>{icon}</span>
                          {label}
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
            <button
              onClick={onClose}
              className="text-sm px-4 py-2 rounded-lg"
              style={{ color: "var(--text-secondary)" }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg text-white font-medium disabled:opacity-60"
              style={{ background: "var(--accent-purple)" }}
            >
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

function FormCard({
  form,
  onEdit,
  onDelete,
  onToggleActive,
  onViewResponses,
}: {
  form: WorkboxForm;
  onEdit: () => void;
  onDelete: () => void;
  onToggleActive: () => void;
  onViewResponses: () => void;
}) {
  const [copied, setCopied] = useState(false);

  function copyLink() {
    navigator.clipboard.writeText(publicUrl(form.id));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div
      className="rounded-xl border p-4 flex flex-col gap-3 hover:border-purple-500/30 transition-colors"
      style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-semibold text-sm truncate" style={{ color: "var(--text-primary)" }}>{form.name}</h3>
          {form.description && (
            <p className="text-xs mt-0.5 line-clamp-2" style={{ color: "var(--text-secondary)" }}>{form.description}</p>
          )}
        </div>
        <button
          onClick={onToggleActive}
          className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium transition-colors ${form.active ? "text-green-400" : ""}`}
          style={{
            background: form.active ? "rgba(34,197,94,0.12)" : "rgba(148,163,184,0.12)",
            color: form.active ? "#22c55e" : "var(--text-secondary)",
          }}
        >
          {form.active ? "Active" : "Inactive"}
        </button>
      </div>

      {/* Meta */}
      <div className="flex items-center gap-3 text-xs" style={{ color: "var(--text-secondary)" }}>
        <span>
          <span className="font-medium" style={{ color: "var(--text-primary)" }}>{form.submissions_count}</span> submissions
        </span>
        {form.target_list && (
          <span className="truncate">→ {form.target_list.name}</span>
        )}
        <span>{form.fields.length} fields</span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-wrap">
        <button
          onClick={copyLink}
          className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border transition-colors"
          style={{ borderColor: copied ? "#22c55e" : "var(--border)", color: copied ? "#22c55e" : "var(--text-secondary)" }}
        >
          {copied ? <><Copy size={11} /> Copied!</> : <><Link size={11} /> Share</>}
        </button>
        <a
          href={`/f/${form.id}`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border"
          style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
        >
          <ExternalLink size={11} /> Open
        </a>
        <button
          onClick={onViewResponses}
          className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border"
          style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
        >
          <Eye size={11} /> Responses
        </button>
        <button
          onClick={onEdit}
          className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border"
          style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
        >
          <FormInput size={11} /> Edit
        </button>
        <button
          onClick={onDelete}
          className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border ml-auto"
          style={{ borderColor: "rgba(239,68,68,0.3)", color: "var(--danger)" }}
        >
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

  const loadForms = useCallback(() => {
    fetch("/api/forms")
      .then((r) => r.json())
      .then((d) => setForms(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadForms();
    fetch("/api/workspace")
      .then((r) => r.json())
      .then((d) => setLists(Array.isArray(d.lists) ? d.lists : []));
  }, [loadForms]);

  function openCreate() {
    setEditingForm(null);
    setShowModal(true);
  }

  function openEdit(form: WorkboxForm) {
    setEditingForm(form);
    setShowModal(true);
  }

  function handleSaved(saved: WorkboxForm) {
    setForms((fs) => {
      const idx = fs.findIndex((f) => f.id === saved.id);
      if (idx >= 0) {
        const next = [...fs];
        next[idx] = saved;
        return next;
      }
      return [saved, ...fs];
    });
    setShowModal(false);
    setEditingForm(null);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this form? All submissions will also be deleted.")) return;
    setForms((fs) => fs.filter((f) => f.id !== id));
    await fetch(`/api/forms?id=${encodeURIComponent(id)}`, { method: "DELETE" });
  }

  async function handleToggleActive(form: WorkboxForm) {
    const updated = { ...form, active: !form.active };
    setForms((fs) => fs.map((f) => (f.id === form.id ? updated : f)));
    await fetch("/api/forms", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: form.id, active: !form.active }),
    });
  }

  return (
    <>
      {/* Modals */}
      {showModal && (
        <FormModal
          initial={editingForm}
          lists={lists}
          onSave={handleSaved}
          onClose={() => { setShowModal(false); setEditingForm(null); }}
        />
      )}
      {responsesForm && (
        <ResponsesModal form={responsesForm} onClose={() => setResponsesForm(null)} />
      )}

      {/* Page */}
      <div className="p-6 max-w-5xl mx-auto overflow-y-auto h-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Forms</h1>
            <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
              Collect requests — they become tasks automatically
            </p>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90"
            style={{ background: "var(--accent-purple)" }}
          >
            <Plus size={14} /> Create Form
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 size={22} className="animate-spin" style={{ color: "var(--text-secondary)" }} />
          </div>
        ) : forms.length === 0 ? (
          <div
            className="rounded-2xl border text-center py-20"
            style={{ borderColor: "var(--border)", borderStyle: "dashed" }}
          >
            <div className="text-5xl mb-4">📋</div>
            <h2 className="text-lg font-semibold mb-2" style={{ color: "var(--text-primary)" }}>No forms yet</h2>
            <p className="text-sm mb-6 max-w-sm mx-auto" style={{ color: "var(--text-secondary)" }}>
              Create your first form to start collecting bug reports, feature requests, or client intake forms. Each submission creates a task in WorkBox.
            </p>
            <button
              onClick={openCreate}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
              style={{ background: "var(--accent-purple)" }}
            >
              <Plus size={15} /> Create your first form
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {forms.map((form) => (
              <FormCard
                key={form.id}
                form={form}
                onEdit={() => openEdit(form)}
                onDelete={() => handleDelete(form.id)}
                onToggleActive={() => handleToggleActive(form)}
                onViewResponses={() => setResponsesForm(form)}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
