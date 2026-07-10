"use client";
import { useState } from "react";
import { Loader2, Star } from "lucide-react";

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

interface PublicForm {
  id: string;
  name: string;
  description?: string;
  fields: FormField[];
}

function StarRatingInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(i => (
        <button key={i} type="button"
          onClick={() => onChange(i)}
          onMouseEnter={() => setHover(i)}
          onMouseLeave={() => setHover(0)}
          className="p-1 transition-colors"
          style={{ color: (hover || value) >= i ? "#f59e0b" : "var(--text-muted)" }}>
          <Star size={24} fill={(hover || value) >= i ? "currentColor" : "none"} />
        </button>
      ))}
      {value > 0 && (
        <span className="ml-2 self-center text-xs" style={{ color: "var(--text-secondary)" }}>{value}/5</span>
      )}
    </div>
  );
}

export default function FormClient({ form }: { form: PublicForm }) {
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setValue(fieldId: string, value: unknown) {
    setValues(v => ({ ...v, [fieldId]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const missing: string[] = [];
    for (const field of form.fields) {
      if (field.required && field.type !== "heading") {
        const val = values[field.id];
        if (val === undefined || val === null || val === "" || val === false || val === 0) {
          missing.push(field.label || "Untitled field");
        }
      }
    }
    if (missing.length > 0) {
      setError(`Please fill in: ${missing.join(", ")}`);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/forms/${form.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: values, submitter_email: email || undefined }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Submission failed. Please try again."); return; }
      setSubmitted(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="text-center py-12">
        <div className="text-5xl mb-4">✓</div>
        <h2 className="text-xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>Submitted!</h2>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>We'll get back to you soon.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Submitter email */}
      <div>
        <label className="text-sm font-medium block mb-1.5" style={{ color: "var(--text-primary)" }}>
          Your email <span className="font-normal text-xs" style={{ color: "var(--text-secondary)" }}>(optional)</span>
        </label>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full text-sm px-4 py-2.5 rounded-xl border outline-none transition-colors"
          style={{ background: "var(--bg-secondary)", borderColor: "var(--border)", color: "var(--text-primary)" }} />
      </div>

      {form.fields.map(field => (
        <div key={field.id}>
          {field.type === "heading" ? (
            <div className="pt-4 pb-1 border-b" style={{ borderColor: "var(--border)" }}>
              <h3 className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>{field.label || "Section"}</h3>
            </div>
          ) : (
            <>
              <label className="text-sm font-medium block mb-1.5" style={{ color: "var(--text-primary)" }}>
                {field.label || "Untitled field"}
                {field.required && <span style={{ color: "#ef4444" }}> *</span>}
              </label>

              {field.type === "textarea" && (
                <textarea value={(values[field.id] as string) ?? ""}
                  onChange={e => setValue(field.id, e.target.value)}
                  placeholder={field.placeholder} required={field.required} rows={4}
                  className="w-full text-sm px-4 py-2.5 rounded-xl border outline-none resize-none transition-colors"
                  style={{ background: "var(--bg-secondary)", borderColor: "var(--border)", color: "var(--text-primary)" }} />
              )}

              {(field.type === "text" || field.type === "email" || field.type === "number" || field.type === "date") && (
                <input type={field.type} value={(values[field.id] as string) ?? ""}
                  onChange={e => setValue(field.id, e.target.value)}
                  placeholder={field.placeholder} required={field.required}
                  className="w-full text-sm px-4 py-2.5 rounded-xl border outline-none transition-colors"
                  style={{ background: "var(--bg-secondary)", borderColor: "var(--border)", color: "var(--text-primary)" }} />
              )}

              {field.type === "phone" && (
                <input type="tel" value={(values[field.id] as string) ?? ""}
                  onChange={e => setValue(field.id, e.target.value)}
                  placeholder={field.placeholder || "+1 (555) 000-0000"} required={field.required}
                  className="w-full text-sm px-4 py-2.5 rounded-xl border outline-none transition-colors"
                  style={{ background: "var(--bg-secondary)", borderColor: "var(--border)", color: "var(--text-primary)" }} />
              )}

              {field.type === "select" && (
                <select value={(values[field.id] as string) ?? ""}
                  onChange={e => setValue(field.id, e.target.value)} required={field.required}
                  className="w-full text-sm px-4 py-2.5 rounded-xl border outline-none transition-colors"
                  style={{ background: "var(--bg-secondary)", borderColor: "var(--border)", color: "var(--text-primary)" }}>
                  <option value="">Select an option...</option>
                  {(field.options ?? []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              )}

              {field.type === "radio" && (
                <div className="space-y-2.5">
                  {(field.options ?? []).map(opt => (
                    <label key={opt} className="flex items-center gap-3 cursor-pointer group">
                      <input type="radio" name={field.id} value={opt}
                        checked={(values[field.id] as string) === opt}
                        onChange={() => setValue(field.id, opt)}
                        className="w-4 h-4" style={{ accentColor: "var(--accent-purple)" }} />
                      <span className="text-sm" style={{ color: "var(--text-primary)" }}>{opt}</span>
                    </label>
                  ))}
                </div>
              )}

              {field.type === "checkbox" && (
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={(values[field.id] as boolean) ?? false}
                    onChange={e => setValue(field.id, e.target.checked)}
                    className="w-4 h-4 rounded" style={{ accentColor: "var(--accent-purple)" }} />
                  <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                    {field.placeholder || field.label}
                  </span>
                </label>
              )}

              {field.type === "rating" && (
                <StarRatingInput value={(values[field.id] as number) ?? 0}
                  onChange={v => setValue(field.id, v)} />
              )}
            </>
          )}
        </div>
      ))}

      {error && (
        <div className="text-sm px-4 py-3 rounded-xl"
          style={{ background: "rgba(255,255,255,0.06)", color: "var(--danger)" }}>
          {error}
        </div>
      )}

      <button type="submit" disabled={submitting}
        className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60 transition-opacity hover:opacity-90"
        style={{ background: "var(--accent-purple)", color: "#fff" }}>
        {submitting && <Loader2 size={15} className="animate-spin" />}
        Submit
      </button>
    </form>
  );
}
