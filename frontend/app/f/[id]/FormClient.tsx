"use client";
import { useState } from "react";
import { Loader2 } from "lucide-react";

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

interface PublicForm {
  id: string;
  name: string;
  description?: string;
  fields: FormField[];
}

export default function FormClient({ form }: { form: PublicForm }) {
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setValue(fieldId: string, value: unknown) {
    setValues((v) => ({ ...v, [fieldId]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Client-side required check
    const missing: string[] = [];
    for (const field of form.fields) {
      if (field.required) {
        const val = values[field.id];
        if (val === undefined || val === null || val === "" || val === false) {
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
        body: JSON.stringify({
          data: values,
          submitter_email: email || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Submission failed. Please try again.");
        return;
      }
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
        <h2 className="text-xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>
          Your request has been submitted!
        </h2>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          We'll get back to you soon.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Submitter email (optional) */}
      <div>
        <label className="text-sm font-medium block mb-1.5" style={{ color: "var(--text-primary)" }}>
          Your email <span className="font-normal text-xs" style={{ color: "var(--text-secondary)" }}>(optional, for follow-up)</span>
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full text-sm px-4 py-2.5 rounded-xl border outline-none transition-colors"
          style={{ background: "var(--bg-secondary)", borderColor: "var(--border)", color: "var(--text-primary)" }}
        />
      </div>

      {/* Form fields */}
      {form.fields.map((field) => (
        <div key={field.id}>
          <label className="text-sm font-medium block mb-1.5" style={{ color: "var(--text-primary)" }}>
            {field.label || "Untitled field"}
            {field.required && <span style={{ color: "#ef4444" }}> *</span>}
          </label>

          {field.type === "textarea" && (
            <textarea
              value={(values[field.id] as string) ?? ""}
              onChange={(e) => setValue(field.id, e.target.value)}
              placeholder={field.placeholder}
              required={field.required}
              rows={4}
              className="w-full text-sm px-4 py-2.5 rounded-xl border outline-none resize-none transition-colors"
              style={{ background: "var(--bg-secondary)", borderColor: "var(--border)", color: "var(--text-primary)" }}
            />
          )}

          {(field.type === "text" || field.type === "email" || field.type === "number" || field.type === "date") && (
            <input
              type={field.type}
              value={(values[field.id] as string) ?? ""}
              onChange={(e) => setValue(field.id, e.target.value)}
              placeholder={field.placeholder}
              required={field.required}
              className="w-full text-sm px-4 py-2.5 rounded-xl border outline-none transition-colors"
              style={{ background: "var(--bg-secondary)", borderColor: "var(--border)", color: "var(--text-primary)" }}
            />
          )}

          {field.type === "select" && (
            <select
              value={(values[field.id] as string) ?? ""}
              onChange={(e) => setValue(field.id, e.target.value)}
              required={field.required}
              className="w-full text-sm px-4 py-2.5 rounded-xl border outline-none transition-colors"
              style={{ background: "var(--bg-secondary)", borderColor: "var(--border)", color: "var(--text-primary)" }}
            >
              <option value="">Select an option...</option>
              {(field.options ?? []).map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          )}

          {field.type === "checkbox" && (
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={(values[field.id] as boolean) ?? false}
                onChange={(e) => setValue(field.id, e.target.checked)}
                className="w-4 h-4 rounded"
                style={{ accentColor: "var(--accent-purple)" }}
              />
              <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                {field.placeholder || field.label}
              </span>
            </label>
          )}
        </div>
      ))}

      {/* Error */}
      {error && (
        <div
          className="text-sm px-4 py-3 rounded-xl"
          style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444" }}
        >
          {error}
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={submitting}
        className="w-full py-3 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-60 transition-opacity hover:opacity-90"
        style={{ background: "var(--accent-purple)" }}
      >
        {submitting && <Loader2 size={15} className="animate-spin" />}
        Submit
      </button>
    </form>
  );
}
