"use client";
import { useState } from "react";
import { X, Sparkles, Loader2, Copy, Check } from "lucide-react";
import { toast } from "@/store/toast";

interface Props {
  contactId: string;
  contactName: string;
  onClose: () => void;
}

/** Draft a personalized outreach email for a CRM contact (AI composer). */
export default function OutreachComposer({ contactId, contactName, onClose }: Props) {
  const [intent, setIntent] = useState("");
  const [tone, setTone] = useState("warm");
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState<{ subject: string; body: string; word_count: number } | null>(null);
  const [copied, setCopied] = useState(false);

  async function generate() {
    if (!intent.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/crm/draft-email", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contact_id: contactId, intent, tone }),
      });
      const d = await res.json();
      if (!res.ok) { toast(d.error ?? "Couldn't draft", { type: "error" }); return; }
      setDraft(d.draft);
    } catch {
      toast("Couldn't draft the email", { type: "error" });
    } finally {
      setLoading(false);
    }
  }

  function copy() {
    if (!draft) return;
    navigator.clipboard?.writeText(`Subject: ${draft.subject}\n\n${draft.body}`).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }} onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl border shadow-2xl flex flex-col max-h-[85vh]"
        style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-2">
            <Sparkles size={15} style={{ color: "var(--accent-purple)" }} />
            <span className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>Draft email to {contactName}</span>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/10" style={{ color: "var(--text-secondary)" }}><X size={15} /></button>
        </div>

        <div className="p-5 overflow-y-auto">
          <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>What do you want to say or offer?</label>
          <textarea autoFocus value={intent} onChange={e => setIntent(e.target.value)} rows={3}
            placeholder="e.g. Introduce our new analytics add-on and ask for a 15-minute call next week"
            className="w-full mt-1.5 px-3 py-2 rounded-lg text-sm outline-none"
            style={{ background: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }} />

          <div className="flex items-center gap-2 mt-3">
            <select value={tone} onChange={e => setTone(e.target.value)}
              className="px-3 py-1.5 rounded-lg text-xs" style={{ background: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }}>
              {["warm", "concise", "formal", "friendly", "direct"].map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <button onClick={generate} disabled={loading || !intent.trim()}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-50"
              style={{ background: "var(--accent-purple)" }}>
              {loading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} {draft ? "Regenerate" : "Generate"}
            </button>
          </div>

          {draft && (
            <div className="mt-4 rounded-xl border p-4" style={{ background: "var(--bg-primary)", borderColor: "var(--border)" }}>
              <input value={draft.subject} onChange={e => setDraft({ ...draft, subject: e.target.value })}
                className="w-full bg-transparent outline-none text-sm font-semibold mb-2" style={{ color: "var(--text-primary)" }} />
              <div className="h-px mb-2" style={{ background: "var(--border)" }} />
              <textarea value={draft.body} onChange={e => setDraft({ ...draft, body: e.target.value })} rows={9}
                className="w-full bg-transparent outline-none text-sm leading-relaxed resize-none" style={{ color: "var(--text-primary)" }} />
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>{draft.body.split(/\s+/).filter(Boolean).length} words</span>
                <button onClick={copy} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                  {copied ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
