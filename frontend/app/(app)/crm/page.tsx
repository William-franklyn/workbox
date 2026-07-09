"use client";
import { useEffect, useState, useCallback } from "react";
import {
  Plus, Search, Users, Building2, TrendingUp, X, Loader2,
  Trash2, Edit3, Mail, Phone, Globe, ChevronDown, DollarSign,
  Calendar, Target,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Company {
  id: string; name: string; industry?: string; website?: string;
  phone?: string; email?: string; size?: string; status?: string; notes?: string; created_at: string;
}
interface Contact {
  id: string; first_name: string; last_name?: string; email?: string;
  phone?: string; job_title?: string; company_id?: string; status?: string;
  notes?: string; tags: string[]; last_contacted?: string; created_at: string;
  company?: { id: string; name: string } | null;
}
interface Deal {
  id: string; title: string; value?: number; currency?: string; stage?: string;
  contact_id?: string; company_id?: string; expected_close?: string;
  probability?: number; notes?: string; created_at: string;
  contact?: { id: string; first_name: string; last_name?: string } | null;
  company?: { id: string; name: string } | null;
}

const STAGES = ["prospect", "qualified", "proposal", "negotiation", "won", "lost"];
const STAGE_COLOR: Record<string, string> = {
  prospect: "#606060", qualified: "#909090", proposal: "#c0c0c0",
  negotiation: "#ffffff", won: "#d0d0d0", lost: "#383838",
};

const CONTACT_STATUS = ["lead", "active", "inactive", "customer"];
const CO_STATUS = ["prospect", "active", "inactive", "customer"];

// Deterministic compact currency formatter. Intl's compact notation renders
// differently between Node (SSR) and the browser (e.g. "$0" vs "$0.0"),
// which causes hydration mismatches.
function fmt(n: number, currency = "USD") {
  const sym = currency === "USD" ? "$" : `${currency} `;
  const abs = Math.abs(n);
  let compact: string;
  if (abs >= 1e9) compact = (n / 1e9).toFixed(1) + "B";
  else if (abs >= 1e6) compact = (n / 1e6).toFixed(1) + "M";
  else if (abs >= 1e3) compact = (n / 1e3).toFixed(1) + "K";
  else compact = String(Math.round(n * 100) / 100);
  return sym + compact.replace(/\.0([BMK])$/, "$1");
}

// ─── Modal ────────────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.75)" }}>
      <div className="w-full max-w-lg rounded-2xl border shadow-2xl flex flex-col max-h-[85vh]"
        style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0" style={{ borderColor: "var(--border)" }}>
          <span className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>{title}</span>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/5" style={{ color: "var(--text-secondary)" }}><X size={16} /></button>
        </div>
        <div className="overflow-y-auto flex-1 p-5">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>{label}</label>
      {children}
    </div>
  );
}

const inputCls = "w-full text-sm px-3 py-2 rounded-lg border outline-none";
const inputStyle = { background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-primary)" };

// ─── Contact Form ─────────────────────────────────────────────────────────────

function ContactForm({ initial, companies, onSave, onClose }: {
  initial?: Contact; companies: Company[];
  onSave: (c: Contact) => void; onClose: () => void;
}) {
  const [f, setF] = useState({
    first_name: initial?.first_name ?? "", last_name: initial?.last_name ?? "",
    email: initial?.email ?? "", phone: initial?.phone ?? "",
    job_title: initial?.job_title ?? "", company_id: initial?.company_id ?? "",
    status: initial?.status ?? "lead", notes: initial?.notes ?? "",
    tags: (initial?.tags ?? []).join(", "),
  });
  const [saving, setSaving] = useState(false);
  const upd = (k: string, v: string) => setF(p => ({ ...p, [k]: v }));

  async function save() {
    if (!f.first_name.trim()) return;
    setSaving(true);
    const body = { type: "contact", ...f, tags: f.tags.split(",").map(t => t.trim()).filter(Boolean), company_id: f.company_id || null };
    const res = await fetch("/api/crm", {
      method: initial ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(initial ? { id: initial.id, ...body } : body),
    });
    const d = await res.json();
    setSaving(false);
    onSave(d);
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="First name *"><input value={f.first_name} onChange={e => upd("first_name", e.target.value)} className={inputCls} style={inputStyle} /></Field>
        <Field label="Last name"><input value={f.last_name} onChange={e => upd("last_name", e.target.value)} className={inputCls} style={inputStyle} /></Field>
      </div>
      <Field label="Email"><input value={f.email} onChange={e => upd("email", e.target.value)} type="email" className={inputCls} style={inputStyle} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Phone"><input value={f.phone} onChange={e => upd("phone", e.target.value)} type="tel" className={inputCls} style={inputStyle} /></Field>
        <Field label="Job title"><input value={f.job_title} onChange={e => upd("job_title", e.target.value)} className={inputCls} style={inputStyle} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Company">
          <select value={f.company_id} onChange={e => upd("company_id", e.target.value)} className={inputCls} style={inputStyle}>
            <option value="">No company</option>
            {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Status">
          <select value={f.status} onChange={e => upd("status", e.target.value)} className={inputCls} style={inputStyle}>
            {CONTACT_STATUS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Tags (comma-separated)"><input value={f.tags} onChange={e => upd("tags", e.target.value)} placeholder="client, vip, enterprise" className={inputCls} style={inputStyle} /></Field>
      <Field label="Notes"><textarea value={f.notes} onChange={e => upd("notes", e.target.value)} rows={3} className={`${inputCls} resize-none`} style={inputStyle} /></Field>
      <div className="flex justify-end gap-2 pt-2">
        <button onClick={onClose} className="text-sm px-4 py-2 rounded-lg" style={{ color: "var(--text-secondary)" }}>Cancel</button>
        <button onClick={save} disabled={saving || !f.first_name.trim()}
          className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg font-medium disabled:opacity-50"
          style={{ background: "var(--accent-purple)", color: "#000" }}>
          {saving && <Loader2 size={13} className="animate-spin" />} Save
        </button>
      </div>
    </div>
  );
}

// ─── Company Form ──────────────────────────────────────────────────────────────

function CompanyForm({ initial, onSave, onClose }: { initial?: Company; onSave: (c: Company) => void; onClose: () => void }) {
  const [f, setF] = useState({
    name: initial?.name ?? "", industry: initial?.industry ?? "",
    website: initial?.website ?? "", phone: initial?.phone ?? "",
    email: initial?.email ?? "", size: initial?.size ?? "small",
    status: initial?.status ?? "prospect", notes: initial?.notes ?? "",
  });
  const [saving, setSaving] = useState(false);
  const upd = (k: string, v: string) => setF(p => ({ ...p, [k]: v }));

  async function save() {
    if (!f.name.trim()) return;
    setSaving(true);
    const res = await fetch("/api/crm", {
      method: initial ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(initial ? { id: initial.id, type: "company", ...f } : { type: "company", ...f }),
    });
    const d = await res.json();
    setSaving(false);
    onSave(d);
  }

  return (
    <div className="space-y-3">
      <Field label="Company name *"><input value={f.name} onChange={e => upd("name", e.target.value)} className={inputCls} style={inputStyle} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Industry"><input value={f.industry} onChange={e => upd("industry", e.target.value)} placeholder="Technology, Finance..." className={inputCls} style={inputStyle} /></Field>
        <Field label="Size">
          <select value={f.size} onChange={e => upd("size", e.target.value)} className={inputCls} style={inputStyle}>
            {["startup","small","medium","large","enterprise"].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Email"><input value={f.email} onChange={e => upd("email", e.target.value)} type="email" className={inputCls} style={inputStyle} /></Field>
        <Field label="Phone"><input value={f.phone} onChange={e => upd("phone", e.target.value)} type="tel" className={inputCls} style={inputStyle} /></Field>
      </div>
      <Field label="Website"><input value={f.website} onChange={e => upd("website", e.target.value)} placeholder="https://..." className={inputCls} style={inputStyle} /></Field>
      <Field label="Status">
        <select value={f.status} onChange={e => upd("status", e.target.value)} className={inputCls} style={inputStyle}>
          {CO_STATUS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </Field>
      <Field label="Notes"><textarea value={f.notes} onChange={e => upd("notes", e.target.value)} rows={3} className={`${inputCls} resize-none`} style={inputStyle} /></Field>
      <div className="flex justify-end gap-2 pt-2">
        <button onClick={onClose} className="text-sm px-4 py-2 rounded-lg" style={{ color: "var(--text-secondary)" }}>Cancel</button>
        <button onClick={save} disabled={saving || !f.name.trim()}
          className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg font-medium disabled:opacity-50"
          style={{ background: "var(--accent-purple)", color: "#000" }}>
          {saving && <Loader2 size={13} className="animate-spin" />} Save
        </button>
      </div>
    </div>
  );
}

// ─── Deal Form ────────────────────────────────────────────────────────────────

function DealForm({ initial, contacts, companies, onSave, onClose }: {
  initial?: Deal; contacts: Contact[]; companies: Company[];
  onSave: (d: Deal) => void; onClose: () => void;
}) {
  const [f, setF] = useState({
    title: initial?.title ?? "", value: String(initial?.value ?? ""),
    currency: initial?.currency ?? "USD", stage: initial?.stage ?? "prospect",
    contact_id: initial?.contact_id ?? "", company_id: initial?.company_id ?? "",
    expected_close: initial?.expected_close ?? "", probability: String(initial?.probability ?? 50),
    notes: initial?.notes ?? "",
  });
  const [saving, setSaving] = useState(false);
  const upd = (k: string, v: string) => setF(p => ({ ...p, [k]: v }));

  async function save() {
    if (!f.title.trim()) return;
    setSaving(true);
    const body = {
      type: "deal", title: f.title, currency: f.currency, stage: f.stage,
      value: f.value ? parseFloat(f.value) : 0,
      contact_id: f.contact_id || null, company_id: f.company_id || null,
      expected_close: f.expected_close || null,
      probability: parseInt(f.probability) || 50,
      notes: f.notes,
    };
    const res = await fetch("/api/crm", {
      method: initial ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(initial ? { id: initial.id, ...body } : body),
    });
    const d = await res.json();
    setSaving(false);
    onSave(d);
  }

  return (
    <div className="space-y-3">
      <Field label="Deal title *"><input value={f.title} onChange={e => upd("title", e.target.value)} className={inputCls} style={inputStyle} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Value"><input value={f.value} onChange={e => upd("value", e.target.value)} type="number" placeholder="0" className={inputCls} style={inputStyle} /></Field>
        <Field label="Currency"><input value={f.currency} onChange={e => upd("currency", e.target.value)} placeholder="USD" className={inputCls} style={inputStyle} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Stage">
          <select value={f.stage} onChange={e => upd("stage", e.target.value)} className={inputCls} style={inputStyle}>
            {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Probability %"><input value={f.probability} onChange={e => upd("probability", e.target.value)} type="number" min="0" max="100" className={inputCls} style={inputStyle} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Contact">
          <select value={f.contact_id} onChange={e => upd("contact_id", e.target.value)} className={inputCls} style={inputStyle}>
            <option value="">No contact</option>
            {contacts.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
          </select>
        </Field>
        <Field label="Company">
          <select value={f.company_id} onChange={e => upd("company_id", e.target.value)} className={inputCls} style={inputStyle}>
            <option value="">No company</option>
            {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Expected close date"><input value={f.expected_close} onChange={e => upd("expected_close", e.target.value)} type="date" className={inputCls} style={inputStyle} /></Field>
      <Field label="Notes"><textarea value={f.notes} onChange={e => upd("notes", e.target.value)} rows={2} className={`${inputCls} resize-none`} style={inputStyle} /></Field>
      <div className="flex justify-end gap-2 pt-2">
        <button onClick={onClose} className="text-sm px-4 py-2 rounded-lg" style={{ color: "var(--text-secondary)" }}>Cancel</button>
        <button onClick={save} disabled={saving || !f.title.trim()}
          className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg font-medium disabled:opacity-50"
          style={{ background: "var(--accent-purple)", color: "#000" }}>
          {saving && <Loader2 size={13} className="animate-spin" />} Save
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CRMPage() {
  const [tab, setTab] = useState<"contacts" | "companies" | "pipeline">("contacts");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<"contact" | "company" | "deal" | null>(null);
  const [editing, setEditing] = useState<Contact | Company | Deal | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch("/api/crm?type=contacts").then(r => r.json()),
      fetch("/api/crm?type=companies").then(r => r.json()),
      fetch("/api/crm?type=deals").then(r => r.json()),
    ]).then(([c, co, d]) => {
      setContacts(Array.isArray(c) ? c : []);
      setCompanies(Array.isArray(co) ? co : []);
      setDeals(Array.isArray(d) ? d : []);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function deleteItem(id: string, type: "contact" | "company" | "deal") {
    if (!confirm("Delete this item?")) return;
    if (type === "contact") setContacts(p => p.filter(x => x.id !== id));
    if (type === "company") setCompanies(p => p.filter(x => x.id !== id));
    if (type === "deal") setDeals(p => p.filter(x => x.id !== id));
    await fetch(`/api/crm?id=${id}&type=${type}`, { method: "DELETE" });
  }

  async function moveDeal(id: string, stage: string) {
    setDeals(p => p.map(d => d.id === id ? { ...d, stage } : d));
    await fetch("/api/crm", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, type: "deal", stage }),
    });
  }

  function handleSaved(item: Contact | Company | Deal, type: "contact" | "company" | "deal") {
    if (type === "contact") setContacts(p => { const i = p.findIndex(x => x.id === (item as Contact).id); if (i >= 0) { const n = [...p]; n[i] = item as Contact; return n; } return [item as Contact, ...p]; });
    if (type === "company") setCompanies(p => { const i = p.findIndex(x => x.id === (item as Company).id); if (i >= 0) { const n = [...p]; n[i] = item as Company; return n; } return [item as Company, ...p]; });
    if (type === "deal") setDeals(p => { const i = p.findIndex(x => x.id === (item as Deal).id); if (i >= 0) { const n = [...p]; n[i] = item as Deal; return n; } return [item as Deal, ...p]; });
    setModal(null); setEditing(null);
  }

  const filteredContacts = contacts.filter(c =>
    `${c.first_name} ${c.last_name} ${c.email} ${c.job_title}`.toLowerCase().includes(search.toLowerCase())
  );
  const filteredCompanies = companies.filter(c =>
    `${c.name} ${c.industry}`.toLowerCase().includes(search.toLowerCase())
  );

  const totalDealValue = deals.filter(d => d.stage !== "lost").reduce((s, d) => s + (d.value ?? 0), 0);
  const wonValue = deals.filter(d => d.stage === "won").reduce((s, d) => s + (d.value ?? 0), 0);

  const TABS = [
    { id: "contacts" as const, label: "Contacts", icon: <Users size={14} />, count: contacts.length },
    { id: "companies" as const, label: "Companies", icon: <Building2 size={14} />, count: companies.length },
    { id: "pipeline" as const, label: "Pipeline", icon: <TrendingUp size={14} />, count: deals.length },
  ];

  return (
    <>
      {modal === "contact" && (
        <Modal title={editing ? "Edit Contact" : "New Contact"} onClose={() => { setModal(null); setEditing(null); }}>
          <ContactForm initial={editing as Contact} companies={companies} onSave={c => handleSaved(c, "contact")} onClose={() => { setModal(null); setEditing(null); }} />
        </Modal>
      )}
      {modal === "company" && (
        <Modal title={editing ? "Edit Company" : "New Company"} onClose={() => { setModal(null); setEditing(null); }}>
          <CompanyForm initial={editing as Company} onSave={c => handleSaved(c, "company")} onClose={() => { setModal(null); setEditing(null); }} />
        </Modal>
      )}
      {modal === "deal" && (
        <Modal title={editing ? "Edit Deal" : "New Deal"} onClose={() => { setModal(null); setEditing(null); }}>
          <DealForm initial={editing as Deal} contacts={contacts} companies={companies} onSave={d => handleSaved(d, "deal")} onClose={() => { setModal(null); setEditing(null); }} />
        </Modal>
      )}

      <div className="flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-0 shrink-0">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>CRM</h1>
              <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>Contacts, companies, and your sales pipeline</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-xs" style={{ color: "var(--text-secondary)" }}>Pipeline value</p>
                <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>{fmt(totalDealValue)} · <span style={{ color: "var(--text-secondary)" }}>Won {fmt(wonValue)}</span></p>
              </div>
              <button onClick={() => { setEditing(null); setModal(tab === "pipeline" ? "deal" : tab === "companies" ? "company" : "contact"); }}
                className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg font-medium"
                style={{ background: "var(--accent-purple)", color: "#000" }}>
                <Plus size={14} /> Add {tab === "pipeline" ? "Deal" : tab === "companies" ? "Company" : "Contact"}
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 border-b" style={{ borderColor: "var(--border)" }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors"
                style={{
                  color: tab === t.id ? "var(--text-primary)" : "var(--text-secondary)",
                  borderBottom: tab === t.id ? "2px solid var(--accent-purple)" : "2px solid transparent",
                }}>
                {t.icon} {t.label}
                <span className="text-xs px-1.5 py-0.5 rounded-full ml-1" style={{ background: "var(--bg-surface)", color: "var(--text-muted)" }}>{t.count}</span>
              </button>
            ))}
            <div className="ml-auto pb-2">
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-secondary)" }} />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search..." className="text-sm pl-9 pr-3 py-1.5 rounded-lg border outline-none"
                  style={{ background: "var(--bg-surface)", borderColor: "var(--border)", color: "var(--text-primary)", width: 200 }} />
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex justify-center py-20"><Loader2 size={22} className="animate-spin" style={{ color: "var(--text-secondary)" }} /></div>
          ) : tab === "contacts" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {filteredContacts.length === 0 ? (
                <div className="col-span-3 text-center py-16">
                  <Users size={32} className="mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
                  <p className="text-sm font-medium mb-1" style={{ color: "var(--text-primary)" }}>No contacts yet</p>
                  <p className="text-xs" style={{ color: "var(--text-secondary)" }}>Add your first contact to start building your CRM.</p>
                </div>
              ) : filteredContacts.map(c => (
                <div key={c.id} className="rounded-xl border p-4 hover:border-white/20 transition-colors group"
                  style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                        style={{ background: "rgba(255,255,255,0.1)", color: "var(--text-primary)" }}>
                        {c.first_name[0]}{c.last_name?.[0] ?? ""}
                      </div>
                      <div>
                        <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{c.first_name} {c.last_name}</p>
                        {c.job_title && <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{c.job_title}</p>}
                        {c.company && <p className="text-xs" style={{ color: "var(--text-muted)" }}>{c.company.name}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { setEditing(c); setModal("contact"); }} className="p-1.5 rounded hover:bg-white/5" style={{ color: "var(--text-secondary)" }}><Edit3 size={12} /></button>
                      <button onClick={() => deleteItem(c.id, "contact")} className="p-1.5 rounded hover:bg-red-500/10" style={{ color: "var(--danger)" }}><Trash2 size={12} /></button>
                    </div>
                  </div>
                  <div className="space-y-1.5 text-xs" style={{ color: "var(--text-secondary)" }}>
                    {c.email && <p className="flex items-center gap-2"><Mail size={11} /> {c.email}</p>}
                    {c.phone && <p className="flex items-center gap-2"><Phone size={11} /> {c.phone}</p>}
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    <span className="text-xs px-2 py-0.5 rounded-full capitalize"
                      style={{ background: "rgba(255,255,255,0.08)", color: "var(--text-secondary)" }}>{c.status}</span>
                    {c.tags?.slice(0, 2).map(t => (
                      <span key={t} className="text-xs px-2 py-0.5 rounded-full"
                        style={{ background: "rgba(255,255,255,0.05)", color: "var(--text-muted)" }}>{t}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : tab === "companies" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {filteredCompanies.length === 0 ? (
                <div className="col-span-3 text-center py-16">
                  <Building2 size={32} className="mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
                  <p className="text-sm font-medium mb-1" style={{ color: "var(--text-primary)" }}>No companies yet</p>
                </div>
              ) : filteredCompanies.map(c => (
                <div key={c.id} className="rounded-xl border p-4 hover:border-white/20 transition-colors group"
                  style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{c.name}</p>
                      {c.industry && <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{c.industry}</p>}
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { setEditing(c); setModal("company"); }} className="p-1.5 rounded hover:bg-white/5" style={{ color: "var(--text-secondary)" }}><Edit3 size={12} /></button>
                      <button onClick={() => deleteItem(c.id, "company")} className="p-1.5 rounded hover:bg-red-500/10" style={{ color: "var(--danger)" }}><Trash2 size={12} /></button>
                    </div>
                  </div>
                  <div className="space-y-1.5 text-xs" style={{ color: "var(--text-secondary)" }}>
                    {c.email && <p className="flex items-center gap-2"><Mail size={11} /> {c.email}</p>}
                    {c.website && <p className="flex items-center gap-2"><Globe size={11} /> {c.website}</p>}
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    <span className="text-xs px-2 py-0.5 rounded-full capitalize"
                      style={{ background: "rgba(255,255,255,0.08)", color: "var(--text-secondary)" }}>{c.size}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full capitalize"
                      style={{ background: "rgba(255,255,255,0.05)", color: "var(--text-muted)" }}>{c.status}</span>
                    <span className="ml-auto text-xs" style={{ color: "var(--text-muted)" }}>
                      {contacts.filter(ct => ct.company_id === c.id).length} contacts
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Pipeline Kanban */
            <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: "60vh" }}>
              {STAGES.map(stage => {
                const stageDeals = deals.filter(d => d.stage === stage);
                const stageValue = stageDeals.reduce((s, d) => s + (d.value ?? 0), 0);
                return (
                  <div key={stage} className="flex-shrink-0 w-64">
                    <div className="flex items-center justify-between mb-3 px-1">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ background: STAGE_COLOR[stage] }} />
                        <span className="text-xs font-semibold uppercase tracking-wide capitalize"
                          style={{ color: "var(--text-secondary)" }}>{stage}</span>
                        <span className="text-xs" style={{ color: "var(--text-muted)" }}>{stageDeals.length}</span>
                      </div>
                      {stageValue > 0 && <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{fmt(stageValue)}</span>}
                    </div>
                    <div className="space-y-2">
                      {stageDeals.map(d => (
                        <div key={d.id} className="rounded-xl border p-3 group"
                          style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{d.title}</p>
                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                              <button onClick={() => { setEditing(d); setModal("deal"); }} className="p-1 rounded hover:bg-white/5" style={{ color: "var(--text-secondary)" }}><Edit3 size={11} /></button>
                              <button onClick={() => deleteItem(d.id, "deal")} className="p-1 rounded hover:bg-red-500/10" style={{ color: "var(--danger)" }}><Trash2 size={11} /></button>
                            </div>
                          </div>
                          {d.value != null && d.value > 0 && (
                            <p className="text-sm font-semibold mt-1" style={{ color: "var(--text-primary)" }}>{fmt(d.value, d.currency)}</p>
                          )}
                          <div className="flex items-center gap-2 mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
                            {d.company && <span className="flex items-center gap-1"><Building2 size={10} />{d.company.name}</span>}
                            {d.expected_close && <span className="flex items-center gap-1"><Calendar size={10} />{d.expected_close}</span>}
                          </div>
                          {d.probability != null && (
                            <div className="mt-2">
                              <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                                <div className="h-full rounded-full" style={{ width: `${d.probability}%`, background: "var(--accent-purple)" }} />
                              </div>
                              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{d.probability}% probability</p>
                            </div>
                          )}
                          {/* Move stage */}
                          <div className="mt-2">
                            <select value={d.stage ?? "prospect"} onChange={e => moveDeal(d.id, e.target.value)}
                              className="w-full text-xs px-2 py-1 rounded border outline-none"
                              style={{ background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-secondary)" }}>
                              {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                          </div>
                        </div>
                      ))}
                      {stageDeals.length === 0 && (
                        <div className="rounded-xl border border-dashed p-4 text-center"
                          style={{ borderColor: "var(--border)" }}>
                          <p className="text-xs" style={{ color: "var(--text-muted)" }}>No deals</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
