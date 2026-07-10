"use client";
import { useEffect, useState } from "react";
import { Send, Plus, Loader2, ArrowLeft, Check, X, Trash2, Mail, Sparkles } from "lucide-react";
import { toast } from "@/store/toast";

interface Campaign { id: string; name: string; intent: string; status: string; counts: Record<string, number>; created_at: string; }
interface CEmail { id: string; contact_id: string; to_email: string | null; subject: string; body: string; status: string; contact?: { first_name: string; last_name?: string; email?: string }; }
interface Contact { id: string; first_name: string; last_name?: string; email?: string; company?: { name: string }; }

const STATUS_COLOR: Record<string, string> = {
  draft: "var(--text-muted)", approved: "var(--accent-blue)", excluded: "var(--text-muted)",
  sent: "var(--accent-purple)", delivered: "#60a5fa", opened: "var(--warning)",
  replied: "var(--success)", bounced: "var(--danger)", failed: "var(--danger)",
};

export default function OutreachPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  function load() {
    return fetch("/api/outreach").then(r => r.json()).then(d => setCampaigns(d.campaigns ?? [])).finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  if (openId) return <CampaignDetail id={openId} onBack={() => { setOpenId(null); load(); }} />;

  return (
    <div className="p-6 max-w-3xl mx-auto overflow-y-auto h-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2">
            <Send size={18} style={{ color: "var(--accent-purple)" }} />
            <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Outreach</h1>
          </div>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>AI-drafted email campaigns to your CRM contacts.</p>
        </div>
        <button onClick={() => setCreating(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ background: "var(--accent-purple)" }}>
          <Plus size={14} /> New campaign
        </button>
      </div>

      {creating && <NewCampaign onClose={() => setCreating(false)} onCreated={(id) => { setCreating(false); load(); setOpenId(id); }} />}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={20} className="animate-spin" style={{ color: "var(--text-secondary)" }} /></div>
      ) : campaigns.length === 0 && !creating ? (
        <div className="text-center py-16 rounded-xl border" style={{ borderColor: "var(--border)" }}>
          <Mail size={32} className="mx-auto mb-3 opacity-20" style={{ color: "var(--text-secondary)" }} />
          <p className="text-sm font-medium mb-1" style={{ color: "var(--text-primary)" }}>No campaigns yet</p>
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>Create one to draft personalized emails to a set of contacts.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {campaigns.map(c => {
            const total = Object.values(c.counts).reduce((s, n) => s + n, 0);
            return (
              <button key={c.id} onClick={() => setOpenId(c.id)}
                className="w-full text-left rounded-xl border p-4 transition-colors hover:bg-white/5"
                style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{c.name}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full capitalize" style={{ background: "var(--bg-surface)", color: "var(--text-secondary)" }}>{c.status}</span>
                </div>
                <p className="text-xs mt-1 line-clamp-1" style={{ color: "var(--text-secondary)" }}>{c.intent}</p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {Object.entries(c.counts).map(([st, n]) => (
                    <span key={st} className="text-xs px-2 py-0.5 rounded-full capitalize" style={{ background: "var(--bg-surface)", color: STATUS_COLOR[st] ?? "var(--text-secondary)" }}>{n} {st}</span>
                  ))}
                  {total === 0 && <span className="text-xs" style={{ color: "var(--text-muted)" }}>No recipients</span>}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function NewCampaign({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [name, setName] = useState("");
  const [intent, setIntent] = useState("");
  const [tone, setTone] = useState("warm");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetch("/api/crm?type=contacts").then(r => r.json()).then(d => Array.isArray(d) && setContacts(d)).catch(() => {}); }, []);

  async function create() {
    if (!name.trim() || !intent.trim() || !selected.length) { toast("Add a name, a message, and at least one contact", { type: "error" }); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/outreach", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, intent, tone, contact_ids: selected }) });
      const d = await res.json();
      if (!res.ok) { toast(d.error ?? "Failed", { type: "error" }); return; }
      toast(`Drafted ${d.drafted} emails`);
      onCreated(d.campaign_id);
    } finally { setSaving(false); }
  }

  return (
    <div className="rounded-xl border p-4 mb-5" style={{ background: "var(--bg-secondary)", borderColor: "var(--accent-purple)" }}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>New campaign</span>
        <button onClick={onClose} style={{ color: "var(--text-secondary)" }}><X size={15} /></button>
      </div>
      <input value={name} onChange={e => setName(e.target.value)} placeholder="Campaign name" autoFocus
        className="w-full px-3 py-2 rounded-lg text-sm outline-none mb-2" style={{ background: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }} />
      <textarea value={intent} onChange={e => setIntent(e.target.value)} rows={2} placeholder="What should each email say or offer? (the AI personalizes it per contact)"
        className="w-full px-3 py-2 rounded-lg text-sm outline-none mb-2" style={{ background: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }} />
      <div className="flex items-center gap-2 mb-3">
        <select value={tone} onChange={e => setTone(e.target.value)} className="px-3 py-1.5 rounded-lg text-xs" style={{ background: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }}>
          {["warm", "concise", "formal", "friendly", "direct"].map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{selected.length} selected</span>
      </div>
      <p className="text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: "var(--text-secondary)" }}>Recipients</p>
      <div className="max-h-48 overflow-y-auto rounded-lg border mb-3" style={{ borderColor: "var(--border)" }}>
        {contacts.length === 0 ? (
          <p className="text-xs p-3" style={{ color: "var(--text-muted)" }}>No CRM contacts yet — add some in CRM first.</p>
        ) : contacts.map(c => {
          const on = selected.includes(c.id);
          return (
            <button key={c.id} onClick={() => setSelected(s => on ? s.filter(i => i !== c.id) : [...s, c.id])}
              className="w-full flex items-center justify-between px-3 py-2 text-left transition-colors hover:bg-white/5" style={{ borderBottom: "1px solid var(--border)" }}>
              <span className="text-sm" style={{ color: "var(--text-primary)" }}>
                {c.first_name} {c.last_name} {!c.email && <span className="text-xs" style={{ color: "var(--warning)" }}>· no email</span>}
              </span>
              {on && <Check size={14} style={{ color: "var(--accent-purple)" }} />}
            </button>
          );
        })}
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="text-xs px-3 py-1.5 rounded-lg" style={{ color: "var(--text-secondary)" }}>Cancel</button>
        <button onClick={create} disabled={saving} className="flex items-center gap-1.5 text-xs px-4 py-1.5 rounded-lg text-white font-medium disabled:opacity-60" style={{ background: "var(--accent-purple)" }}>
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} Draft campaign
        </button>
      </div>
    </div>
  );
}

function CampaignDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [emails, setEmails] = useState<CEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  function load() {
    return fetch(`/api/outreach/${id}`).then(r => r.json()).then(d => { setCampaign(d.campaign); setEmails(d.emails ?? []); }).finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, [id]);

  async function patchEmail(email_id: string, patch: Record<string, unknown>) {
    setEmails(es => es.map(e => e.id === email_id ? { ...e, ...patch } : e));
    await fetch(`/api/outreach/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email_id, ...patch }) });
  }

  async function send() {
    setSending(true);
    try {
      const res = await fetch(`/api/outreach/${id}/send`, { method: "POST" });
      const d = await res.json();
      if (!res.ok) { toast(d.error ?? "Send failed", { type: "error" }); return; }
      toast(`Sent ${d.sent}${d.failed ? `, ${d.failed} failed` : ""}`);
      load();
    } finally { setSending(false); }
  }

  const approved = emails.filter(e => e.status === "approved").length;

  return (
    <div className="p-6 max-w-3xl mx-auto overflow-y-auto h-full">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm mb-4" style={{ color: "var(--text-secondary)" }}><ArrowLeft size={14} /> Campaigns</button>
      {loading || !campaign ? (
        <div className="flex justify-center py-16"><Loader2 size={20} className="animate-spin" style={{ color: "var(--text-secondary)" }} /></div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-1">
            <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{campaign.name}</h1>
            <button onClick={send} disabled={sending || approved === 0}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-40" style={{ background: "var(--accent-purple)" }}>
              {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Send {approved > 0 ? `(${approved})` : ""}
            </button>
          </div>
          <p className="text-sm mb-5" style={{ color: "var(--text-secondary)" }}>{campaign.intent}</p>

          <div className="space-y-3">
            {emails.map(e => (
              <div key={e.id} className="rounded-xl border p-4" style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{e.contact?.first_name} {e.contact?.last_name}</span>
                    <span className="text-xs ml-2" style={{ color: e.to_email ? "var(--text-muted)" : "var(--warning)" }}>{e.to_email ?? "no email — enrich in CRM"}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs px-2 py-0.5 rounded-full capitalize" style={{ background: "var(--bg-surface)", color: STATUS_COLOR[e.status] ?? "var(--text-secondary)" }}>{e.status}</span>
                    {["draft", "approved", "excluded"].includes(e.status) && e.to_email && (
                      <>
                        <button onClick={() => patchEmail(e.id, { status: e.status === "approved" ? "draft" : "approved" })} title="Approve"
                          className="p-1 rounded hover:bg-white/10" style={{ color: e.status === "approved" ? "var(--success)" : "var(--text-secondary)" }}><Check size={13} /></button>
                        <button onClick={() => patchEmail(e.id, { status: "excluded" })} title="Exclude"
                          className="p-1 rounded hover:bg-white/10" style={{ color: "var(--text-secondary)" }}><Trash2 size={12} /></button>
                      </>
                    )}
                  </div>
                </div>
                {["draft", "approved"].includes(e.status) ? (
                  <>
                    <input value={e.subject} onChange={ev => setEmails(es => es.map(x => x.id === e.id ? { ...x, subject: ev.target.value } : x))}
                      onBlur={ev => patchEmail(e.id, { subject: ev.target.value })}
                      className="w-full bg-transparent outline-none text-sm font-medium mb-1.5" style={{ color: "var(--text-primary)" }} />
                    <textarea value={e.body} onChange={ev => setEmails(es => es.map(x => x.id === e.id ? { ...x, body: ev.target.value } : x))}
                      onBlur={ev => patchEmail(e.id, { body: ev.target.value })} rows={5}
                      className="w-full bg-transparent outline-none text-sm leading-relaxed resize-none" style={{ color: "var(--text-secondary)" }} />
                  </>
                ) : (
                  <p className="text-sm" style={{ color: "var(--text-muted)" }}>{e.subject}</p>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
