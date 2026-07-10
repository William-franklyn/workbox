"use client";
import { useEffect, useState, useRef } from "react";
import { Clock, DollarSign, FileText, Plus, Trash2, Printer, ChevronDown, CheckCircle2, Send, AlertCircle, X } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface TimeEntry {
  id: string; description: string; date: string;
  hours: number; hourly_rate: number; billable: boolean;
}
interface Expense {
  id: string; description: string; category: string;
  amount: number; currency: string; date: string; billable: boolean;
}
interface InvoiceItem { label: string; qty: number; rate: number; total: number; }
interface Invoice {
  id: string; invoice_number: string; client_name: string; client_email: string;
  status: "draft" | "sent" | "paid" | "overdue";
  items: InvoiceItem[]; subtotal: number; tax_rate: number; tax_amount: number;
  total: number; notes: string; due_date: string; created_at: string;
}

const EXPENSE_CATEGORIES = ["API Costs","Software","Services","Hardware","Travel","Marketing","Hosting","Other"];
const STATUS_STYLE: Record<Invoice["status"], { bg: string; color: string; label: string }> = {
  draft:   { bg: "rgba(148,163,184,0.15)", color: "#94a3b8", label: "Draft" },
  sent:    { bg: "rgba(59,130,246,0.15)",  color: "#3b82f6", label: "Sent" },
  paid:    { bg: "rgba(34,197,94,0.15)",   color: "#22c55e", label: "Paid" },
  overdue: { bg: "rgba(239,68,68,0.15)",   color: "#ef4444", label: "Overdue" },
};

function fmt(n: number) { return `$${Number(n).toFixed(2)}`; }
function fmtDate(d: string) { return d ? new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : ""; }

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function TimesheetsPage() {
  const [tab, setTab] = useState<"overview" | "time" | "expenses" | "invoices">("overview");
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [expenses, setExpenses]       = useState<Expense[]>([]);
  const [invoices, setInvoices]       = useState<Invoice[]>([]);
  const [loading, setLoading]         = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/timesheets").then(r => r.json()),
      fetch("/api/expenses").then(r => r.json()),
      fetch("/api/invoices").then(r => r.json()),
    ]).then(([t, e, i]) => {
      if (Array.isArray(t)) setTimeEntries(t);
      if (Array.isArray(e)) setExpenses(e);
      if (Array.isArray(i)) setInvoices(i);
    }).finally(() => setLoading(false));
  }, []);

  // Stats
  const totalHours    = timeEntries.reduce((s, e) => s + Number(e.hours), 0);
  const billableAmt   = timeEntries.filter(e => e.billable).reduce((s, e) => s + e.hours * e.hourly_rate, 0);
  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const outstanding   = invoices.filter(i => i.status === "sent" || i.status === "overdue").reduce((s, i) => s + Number(i.total), 0);

  const TABS = [
    { key: "overview", label: "Overview",  icon: <Clock size={14}/> },
    { key: "time",     label: "Time Logs", icon: <Clock size={14}/> },
    { key: "expenses", label: "Expenses",  icon: <DollarSign size={14}/> },
    { key: "invoices", label: "Invoices",  icon: <FileText size={14}/> },
  ] as const;

  if (loading) return (
    <div className="flex items-center justify-center h-full" style={{ color: "var(--text-secondary)" }}>
      Loading…
    </div>
  );

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: "var(--bg-primary)" }}>
      {/* Tab bar */}
      <div className="border-b shrink-0" style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}>
        <div className="flex items-center px-4">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className="flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition-colors"
              style={{
                borderColor: tab === t.key ? "var(--accent-purple)" : "transparent",
                color: tab === t.key ? "var(--accent-purple)" : "var(--text-secondary)",
              }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {tab === "overview" && (
          <OverviewTab
            totalHours={totalHours} billableAmt={billableAmt}
            totalExpenses={totalExpenses} outstanding={outstanding}
            timeEntries={timeEntries} expenses={expenses} invoices={invoices}
            onNavigate={setTab}
          />
        )}
        {tab === "time" && (
          <TimeTab entries={timeEntries} onAdd={e => setTimeEntries(p => [e, ...p])} onDelete={id => setTimeEntries(p => p.filter(e => e.id !== id))} />
        )}
        {tab === "expenses" && (
          <ExpensesTab entries={expenses} onAdd={e => setExpenses(p => [e, ...p])} onDelete={id => setExpenses(p => p.filter(e => e.id !== id))} />
        )}
        {tab === "invoices" && (
          <InvoicesTab
            invoices={invoices} timeEntries={timeEntries} expenses={expenses}
            onAdd={(inv: Invoice) => setInvoices(p => [inv, ...p])}
            onUpdate={(inv: Invoice) => setInvoices(p => p.map(i => i.id === inv.id ? inv : i))}
            onDelete={(id: string) => setInvoices(p => p.filter(i => i.id !== id))}
          />
        )}
      </div>
    </div>
  );
}

// ─── Overview ────────────────────────────────────────────────────────────────
function OverviewTab({ totalHours, billableAmt, totalExpenses, outstanding, timeEntries, expenses, invoices, onNavigate }: any) {
  const stats = [
    { label: "Total Hours",        value: `${totalHours.toFixed(1)} hrs`, icon: <Clock size={18}/>,       color: "#7c3aed" },
    { label: "Billable Amount",    value: fmt(billableAmt),               icon: <DollarSign size={18}/>,  color: "#22c55e" },
    { label: "Total Expenses",     value: fmt(totalExpenses),             icon: <DollarSign size={18}/>,  color: "#f59e0b" },
    { label: "Outstanding",        value: fmt(outstanding),               icon: <FileText size={18}/>,    color: "#3b82f6" },
  ];
  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Billing & Timesheets</h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>Track time, log expenses, and generate invoices for your projects.</p>
      </div>
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(s => (
          <div key={s.label} className="rounded-xl p-4 border" style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${s.color}22`, color: s.color }}>{s.icon}</div>
            </div>
            <p className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{s.value}</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>{s.label}</p>
          </div>
        ))}
      </div>
      {/* Quick actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { tab: "time",     icon: <Clock size={16}/>,       title: "Log Time",        desc: "Record hours spent on a project or task", color: "#7c3aed" },
          { tab: "expenses", icon: <DollarSign size={16}/>,  title: "Add Expense",     desc: "Log API costs, tools, services and more", color: "#f59e0b" },
          { tab: "invoices", icon: <FileText size={16}/>,    title: "Create Invoice",  desc: "Generate a bill from logged time & expenses", color: "#3b82f6" },
        ].map(a => (
          <button key={a.tab} onClick={() => onNavigate(a.tab)}
            className="flex items-start gap-3 p-4 rounded-xl border text-left hover:border-purple-500/30 transition-colors"
            style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: `${a.color}22`, color: a.color }}>{a.icon}</div>
            <div>
              <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{a.title}</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>{a.desc}</p>
            </div>
          </button>
        ))}
      </div>
      {/* Recent invoices */}
      {invoices.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>Recent Invoices</h2>
          <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
            {invoices.slice(0, 5).map((inv: Invoice) => {
              const s = STATUS_STYLE[inv.status];
              return (
                <div key={inv.id} className="flex items-center gap-4 px-4 py-3 border-b last:border-b-0" style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}>
                  <span className="text-xs font-mono" style={{ color: "var(--text-secondary)" }}>{inv.invoice_number}</span>
                  <span className="flex-1 text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{inv.client_name}</span>
                  <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{fmt(inv.total)}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: s.bg, color: s.color }}>{s.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Time Logs ───────────────────────────────────────────────────────────────
function TimeTab({ entries, onAdd, onDelete }: { entries: TimeEntry[]; onAdd: (e: TimeEntry) => void; onDelete: (id: string) => void }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ description: "", date: new Date().toISOString().split("T")[0], hours: "", hourly_rate: "", billable: true });
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!form.description || !form.hours) return;
    setSaving(true);
    const res = await fetch("/api/timesheets", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, hours: parseFloat(form.hours), hourly_rate: parseFloat(form.hourly_rate) || 0 }),
    });
    if (res.ok) { onAdd(await res.json()); setShowForm(false); setForm({ description: "", date: new Date().toISOString().split("T")[0], hours: "", hourly_rate: "", billable: true }); }
    setSaving(false);
  }

  const totalHours = entries.reduce((s, e) => s + Number(e.hours), 0);
  const billable   = entries.filter(e => e.billable).reduce((s, e) => s + e.hours * e.hourly_rate, 0);

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>Time Logs</h2>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>{totalHours.toFixed(1)} hrs logged · {fmt(billable)} billable</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
          style={{ background: "var(--accent-purple)" }}>
          <Plus size={13}/> Log Time
        </button>
      </div>

      {showForm && (
        <div className="rounded-xl border p-4 space-y-3" style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>New Time Entry</p>
          <input placeholder="Description (e.g. API integration work)" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg text-sm bg-transparent border outline-none focus:border-purple-500"
            style={{ borderColor: "var(--border)", color: "var(--text-primary)" }} />
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs mb-1 block" style={{ color: "var(--text-secondary)" }}>Date</label>
              <input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg text-sm bg-transparent border outline-none focus:border-purple-500"
                style={{ borderColor: "var(--border)", color: "var(--text-primary)" }} />
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: "var(--text-secondary)" }}>Hours</label>
              <input type="number" step="0.25" min="0" placeholder="0.00" value={form.hours} onChange={e => setForm(p => ({ ...p, hours: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg text-sm bg-transparent border outline-none focus:border-purple-500"
                style={{ borderColor: "var(--border)", color: "var(--text-primary)" }} />
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: "var(--text-secondary)" }}>Rate / hr ($)</label>
              <input type="number" step="1" min="0" placeholder="0.00" value={form.hourly_rate} onChange={e => setForm(p => ({ ...p, hourly_rate: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg text-sm bg-transparent border outline-none focus:border-purple-500"
                style={{ borderColor: "var(--border)", color: "var(--text-primary)" }} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="billable-time" checked={form.billable} onChange={e => setForm(p => ({ ...p, billable: e.target.checked }))} />
            <label htmlFor="billable-time" className="text-xs" style={{ color: "var(--text-secondary)" }}>Billable</label>
          </div>
          <div className="flex gap-2">
            <button onClick={save} disabled={saving}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-50"
              style={{ background: "var(--accent-purple)" }}>{saving ? "Saving…" : "Save"}</button>
            <button onClick={() => setShowForm(false)} className="px-4 py-1.5 rounded-lg text-xs border"
              style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>Cancel</button>
          </div>
        </div>
      )}

      <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
        {entries.length === 0 ? (
          <div className="py-12 text-center text-sm" style={{ color: "var(--text-secondary)", background: "var(--bg-secondary)" }}>No time entries yet. Log your first entry above.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b" style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}>
                {["Date","Description","Hours","Rate","Amount",""].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map(e => (
                <tr key={e.id} className="border-b last:border-b-0 hover:bg-white/2" style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}>
                  <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>{fmtDate(e.date)}</td>
                  <td className="px-4 py-3" style={{ color: "var(--text-primary)" }}>
                    <span>{e.description}</span>
                    {!e.billable && <span className="ml-2 text-xs px-1.5 py-0.5 rounded" style={{ background: "rgba(148,163,184,0.1)", color: "#94a3b8" }}>Non-billable</span>}
                  </td>
                  <td className="px-4 py-3 text-xs font-mono" style={{ color: "var(--text-primary)" }}>{Number(e.hours).toFixed(2)}</td>
                  <td className="px-4 py-3 text-xs font-mono" style={{ color: "var(--text-secondary)" }}>{e.hourly_rate ? fmt(e.hourly_rate) : "—"}</td>
                  <td className="px-4 py-3 text-xs font-mono font-semibold" style={{ color: e.billable ? "#22c55e" : "var(--text-secondary)" }}>
                    {e.billable && e.hourly_rate ? fmt(e.hours * e.hourly_rate) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => { fetch("/api/timesheets", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: e.id }) }); onDelete(e.id); }}
                      className="p-1 rounded hover:bg-red-500/10 transition-colors" style={{ color: "var(--danger)" }}><Trash2 size={12}/></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── Expenses ────────────────────────────────────────────────────────────────
function ExpensesTab({ entries, onAdd, onDelete }: { entries: Expense[]; onAdd: (e: Expense) => void; onDelete: (id: string) => void }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ description: "", category: "API Costs", amount: "", currency: "USD", date: new Date().toISOString().split("T")[0], billable: true });
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!form.description || !form.amount) return;
    setSaving(true);
    const res = await fetch("/api/expenses", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, amount: parseFloat(form.amount) }),
    });
    if (res.ok) { onAdd(await res.json()); setShowForm(false); setForm({ description: "", category: "API Costs", amount: "", currency: "USD", date: new Date().toISOString().split("T")[0], billable: true }); }
    setSaving(false);
  }

  const byCategory = EXPENSE_CATEGORIES.map(cat => ({
    cat, total: entries.filter(e => e.category === cat).reduce((s, e) => s + Number(e.amount), 0),
  })).filter(x => x.total > 0);

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>Expenses</h2>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>Total: {fmt(entries.reduce((s, e) => s + Number(e.amount), 0))}</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
          style={{ background: "var(--accent-purple)" }}>
          <Plus size={13}/> Add Expense
        </button>
      </div>

      {/* Category breakdown */}
      {byCategory.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {byCategory.map(x => (
            <span key={x.cat} className="text-xs px-2.5 py-1 rounded-full border" style={{ borderColor: "var(--border)", color: "var(--text-secondary)", background: "var(--bg-secondary)" }}>
              {x.cat}: <strong style={{ color: "var(--text-primary)" }}>{fmt(x.total)}</strong>
            </span>
          ))}
        </div>
      )}

      {showForm && (
        <div className="rounded-xl border p-4 space-y-3" style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>New Expense</p>
          <input placeholder="Description (e.g. OpenAI API usage - June)" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg text-sm bg-transparent border outline-none focus:border-purple-500"
            style={{ borderColor: "var(--border)", color: "var(--text-primary)" }} />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="text-xs mb-1 block" style={{ color: "var(--text-secondary)" }}>Category</label>
              <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg text-sm bg-transparent border outline-none focus:border-purple-500"
                style={{ borderColor: "var(--border)", color: "var(--text-primary)", background: "var(--bg-secondary)" }}>
                {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: "var(--text-secondary)" }}>Amount ($)</label>
              <input type="number" step="0.01" min="0" placeholder="0.00" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg text-sm bg-transparent border outline-none focus:border-purple-500"
                style={{ borderColor: "var(--border)", color: "var(--text-primary)" }} />
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: "var(--text-secondary)" }}>Currency</label>
              <select value={form.currency} onChange={e => setForm(p => ({ ...p, currency: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg text-sm bg-transparent border outline-none"
                style={{ borderColor: "var(--border)", color: "var(--text-primary)", background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
                {["USD","EUR","GBP","CAD","AUD"].map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: "var(--text-secondary)" }}>Date</label>
              <input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg text-sm bg-transparent border outline-none focus:border-purple-500"
                style={{ borderColor: "var(--border)", color: "var(--text-primary)" }} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="billable-exp" checked={form.billable} onChange={e => setForm(p => ({ ...p, billable: e.target.checked }))} />
            <label htmlFor="billable-exp" className="text-xs" style={{ color: "var(--text-secondary)" }}>Billable to client</label>
          </div>
          <div className="flex gap-2">
            <button onClick={save} disabled={saving} className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-50" style={{ background: "var(--accent-purple)" }}>{saving ? "Saving…" : "Save"}</button>
            <button onClick={() => setShowForm(false)} className="px-4 py-1.5 rounded-lg text-xs border" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>Cancel</button>
          </div>
        </div>
      )}

      <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
        {entries.length === 0 ? (
          <div className="py-12 text-center text-sm" style={{ color: "var(--text-secondary)", background: "var(--bg-secondary)" }}>No expenses yet. Log API costs, tools, services and more.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b" style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}>
                {["Date","Description","Category","Amount",""].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map(e => (
                <tr key={e.id} className="border-b last:border-b-0 hover:bg-white/2" style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}>
                  <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>{fmtDate(e.date)}</td>
                  <td className="px-4 py-3" style={{ color: "var(--text-primary)" }}>
                    {e.description}
                    {!e.billable && <span className="ml-2 text-xs px-1.5 py-0.5 rounded" style={{ background: "rgba(148,163,184,0.1)", color: "#94a3b8" }}>Non-billable</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(124,58,237,0.15)", color: "var(--accent-purple)" }}>{e.category}</span>
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold font-mono" style={{ color: "var(--text-primary)" }}>{e.currency} {Number(e.amount).toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => { fetch("/api/expenses", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: e.id }) }); onDelete(e.id); }}
                      className="p-1 rounded hover:bg-red-500/10" style={{ color: "var(--danger)" }}><Trash2 size={12}/></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── Invoices ────────────────────────────────────────────────────────────────
function InvoicesTab({ invoices, timeEntries, expenses, onAdd, onUpdate, onDelete }: any) {
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState<Invoice | null>(null);

  return (
    <div className="max-w-4xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>Invoices</h2>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>{invoices.length} invoice{invoices.length !== 1 ? "s" : ""}</p>
        </div>
        <button onClick={() => setCreating(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
          style={{ background: "var(--accent-purple)" }}>
          <Plus size={13}/> New Invoice
        </button>
      </div>

      {creating && (
        <InvoiceForm
          timeEntries={timeEntries} expenses={expenses}
          onSave={(inv: Invoice) => { onAdd(inv); setCreating(false); }}
          onCancel={() => setCreating(false)}
        />
      )}

      {viewing && (
        <InvoicePreview invoice={viewing} onClose={() => setViewing(null)}
          onStatusChange={(status) => {
            const updated = { ...viewing, status };
            fetch("/api/invoices", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: viewing.id, status }) });
            onUpdate(updated);
            setViewing(updated);
          }}
        />
      )}

      <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
        {invoices.length === 0 ? (
          <div className="py-12 text-center text-sm" style={{ color: "var(--text-secondary)", background: "var(--bg-secondary)" }}>
            No invoices yet. Create your first invoice from logged time and expenses.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b" style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}>
                {["Invoice #","Client","Date","Due","Total","Status",""].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv: Invoice) => {
                const s = STATUS_STYLE[inv.status];
                return (
                  <tr key={inv.id} className="border-b last:border-b-0 hover:bg-white/2 cursor-pointer" style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}
                    onClick={() => setViewing(inv)}>
                    <td className="px-4 py-3 text-xs font-mono" style={{ color: "var(--accent-purple)" }}>{inv.invoice_number}</td>
                    <td className="px-4 py-3 font-medium" style={{ color: "var(--text-primary)" }}>{inv.client_name}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: "var(--text-secondary)" }}>{fmtDate(inv.created_at?.split("T")[0])}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: "var(--text-secondary)" }}>{inv.due_date ? fmtDate(inv.due_date) : "—"}</td>
                    <td className="px-4 py-3 font-semibold font-mono" style={{ color: "var(--text-primary)" }}>{fmt(inv.total)}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: s.bg, color: s.color }}>{s.label}</span>
                    </td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <button onClick={() => { fetch("/api/invoices", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: inv.id }) }); onDelete(inv.id); }}
                        className="p-1 rounded hover:bg-red-500/10" style={{ color: "var(--danger)" }}><Trash2 size={12}/></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── Invoice Form ─────────────────────────────────────────────────────────────
function InvoiceForm({ timeEntries, expenses, onSave, onCancel }: any) {
  const [form, setForm] = useState({ client_name: "", client_email: "", due_date: "", tax_rate: "0", notes: "" });
  const [items, setItems] = useState<InvoiceItem[]>([{ label: "", qty: 1, rate: 0, total: 0 }]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  function updateItem(i: number, field: keyof InvoiceItem, value: string | number) {
    setItems(prev => prev.map((item, idx) => {
      if (idx !== i) return item;
      const updated = { ...item, [field]: value };
      updated.total = Number(updated.qty) * Number(updated.rate);
      return updated;
    }));
  }

  function addFromTime(e: TimeEntry) {
    setItems(prev => [...prev, { label: `${e.description} (${e.hours}h @ ${fmt(e.hourly_rate)}/hr)`, qty: Number(e.hours), rate: Number(e.hourly_rate), total: e.hours * e.hourly_rate }]);
  }

  function addFromExpense(e: Expense) {
    setItems(prev => [...prev, { label: `${e.description} [${e.category}]`, qty: 1, rate: Number(e.amount), total: Number(e.amount) }]);
  }

  const subtotal = items.reduce((s, i) => s + Number(i.total), 0);
  const taxAmt   = subtotal * (parseFloat(form.tax_rate) || 0) / 100;
  const total    = subtotal + taxAmt;

  async function save() {
    if (!form.client_name) return;
    setSaving(true);
    setSaveError(null);
    const invNum = `INV-${Date.now().toString().slice(-6)}`;
    const payload = { ...form, invoice_number: invNum, tax_rate: parseFloat(form.tax_rate) || 0, items, subtotal, tax_amount: taxAmt, total, status: "draft" };
    try {
      const res = await fetch("/api/invoices", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (res.ok) { onSave(data); return; }
      setSaveError(data?.error ?? `Server error ${res.status}. Make sure you've run the billing SQL migration in Supabase.`);
    } catch (e) {
      setSaveError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border p-5 space-y-4" style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
      <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>New Invoice</p>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs mb-1 block" style={{ color: "var(--text-secondary)" }}>Client Name *</label>
          <input placeholder="Acme Corp" value={form.client_name} onChange={e => setForm(p => ({ ...p, client_name: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg text-sm bg-transparent border outline-none focus:border-purple-500"
            style={{ borderColor: "var(--border)", color: "var(--text-primary)" }} />
        </div>
        <div>
          <label className="text-xs mb-1 block" style={{ color: "var(--text-secondary)" }}>Client Email</label>
          <input type="email" placeholder="billing@acme.com" value={form.client_email} onChange={e => setForm(p => ({ ...p, client_email: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg text-sm bg-transparent border outline-none focus:border-purple-500"
            style={{ borderColor: "var(--border)", color: "var(--text-primary)" }} />
        </div>
        <div>
          <label className="text-xs mb-1 block" style={{ color: "var(--text-secondary)" }}>Due Date</label>
          <input type="date" value={form.due_date} onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg text-sm bg-transparent border outline-none focus:border-purple-500"
            style={{ borderColor: "var(--border)", color: "var(--text-primary)" }} />
        </div>
        <div>
          <label className="text-xs mb-1 block" style={{ color: "var(--text-secondary)" }}>Tax Rate (%)</label>
          <input type="number" min="0" max="100" placeholder="0" value={form.tax_rate} onChange={e => setForm(p => ({ ...p, tax_rate: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg text-sm bg-transparent border outline-none focus:border-purple-500"
            style={{ borderColor: "var(--border)", color: "var(--text-primary)" }} />
        </div>
      </div>

      {/* Import from time/expenses */}
      {(timeEntries.filter((e: TimeEntry) => e.billable).length > 0 || expenses.filter((e: Expense) => e.billable).length > 0) && (
        <div className="p-3 rounded-lg border space-y-2" style={{ borderColor: "var(--border)", background: "var(--bg-primary)" }}>
          <p className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>Add from logged time & expenses</p>
          <div className="flex flex-wrap gap-2">
            {timeEntries.filter((e: TimeEntry) => e.billable && e.hourly_rate > 0).map((e: TimeEntry) => (
              <button key={e.id} onClick={() => addFromTime(e)}
                className="text-xs px-2.5 py-1 rounded-lg border hover:border-purple-500/50 transition-colors"
                style={{ borderColor: "var(--border)", color: "var(--text-secondary)", background: "var(--bg-secondary)" }}>
                + {e.description.slice(0, 30)} ({e.hours}h)
              </button>
            ))}
            {expenses.filter((e: Expense) => e.billable).map((e: Expense) => (
              <button key={e.id} onClick={() => addFromExpense(e)}
                className="text-xs px-2.5 py-1 rounded-lg border hover:border-purple-500/50 transition-colors"
                style={{ borderColor: "var(--border)", color: "var(--text-secondary)", background: "var(--bg-secondary)" }}>
                + {e.description.slice(0, 30)} ({fmt(e.amount)})
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Line items */}
      <div>
        <p className="text-xs font-semibold mb-2" style={{ color: "var(--text-secondary)" }}>Line Items</p>
        <div className="space-y-2">
          {items.map((item, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-center">
              <input className="col-span-6 px-2 py-1.5 rounded-lg text-xs bg-transparent border outline-none focus:border-purple-500"
                style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                placeholder="Description" value={item.label} onChange={e => updateItem(i, "label", e.target.value)} />
              <input type="number" className="col-span-2 px-2 py-1.5 rounded-lg text-xs bg-transparent border outline-none text-center"
                style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                placeholder="Qty" value={item.qty} onChange={e => updateItem(i, "qty", parseFloat(e.target.value) || 0)} />
              <input type="number" className="col-span-2 px-2 py-1.5 rounded-lg text-xs bg-transparent border outline-none text-right"
                style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                placeholder="Rate" value={item.rate} onChange={e => updateItem(i, "rate", parseFloat(e.target.value) || 0)} />
              <span className="col-span-1 text-xs font-semibold text-right font-mono" style={{ color: "var(--text-primary)" }}>{fmt(item.total)}</span>
              <button onClick={() => setItems(p => p.filter((_, j) => j !== i))} className="col-span-1 p-1 rounded hover:bg-red-500/10 flex items-center justify-center" style={{ color: "var(--danger)" }}>
                <X size={12}/>
              </button>
            </div>
          ))}
        </div>
        <button onClick={() => setItems(p => [...p, { label: "", qty: 1, rate: 0, total: 0 }])}
          className="mt-2 text-xs flex items-center gap-1" style={{ color: "var(--accent-purple)" }}>
          <Plus size={11}/> Add item
        </button>
      </div>

      {/* Totals */}
      <div className="border-t pt-3 space-y-1" style={{ borderColor: "var(--border)" }}>
        <div className="flex justify-between text-xs" style={{ color: "var(--text-secondary)" }}><span>Subtotal</span><span className="font-mono">{fmt(subtotal)}</span></div>
        {taxAmt > 0 && <div className="flex justify-between text-xs" style={{ color: "var(--text-secondary)" }}><span>Tax ({form.tax_rate}%)</span><span className="font-mono">{fmt(taxAmt)}</span></div>}
        <div className="flex justify-between text-sm font-bold" style={{ color: "var(--text-primary)" }}><span>Total</span><span className="font-mono">{fmt(total)}</span></div>
      </div>

      <textarea placeholder="Notes (payment terms, bank details, etc.)" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2}
        className="w-full px-3 py-2 rounded-lg text-sm bg-transparent border outline-none focus:border-purple-500 resize-none"
        style={{ borderColor: "var(--border)", color: "var(--text-primary)" }} />

      {saveError && (
        <div className="p-3 rounded-lg text-xs" style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>
          <strong>Error:</strong> {saveError}
        </div>
      )}

      <div className="flex gap-2">
        <button onClick={save} disabled={saving || !form.client_name}
          className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-50" style={{ background: "var(--accent-purple)" }}>
          {saving ? "Saving…" : "Create Invoice"}
        </button>
        <button onClick={onCancel} className="px-4 py-1.5 rounded-lg text-xs border" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>Cancel</button>
      </div>
    </div>
  );
}

// ─── Invoice Preview ──────────────────────────────────────────────────────────
function InvoicePreview({ invoice, onClose, onStatusChange }: { invoice: Invoice; onClose: () => void; onStatusChange: (s: Invoice["status"]) => void }) {
  const s = STATUS_STYLE[invoice.status];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }} onClick={onClose}>
      <div className="w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}
        onClick={e => e.stopPropagation()}>
        {/* Invoice header */}
        <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: "var(--border)" }}>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{invoice.invoice_number}</h2>
              <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: s.bg, color: s.color }}>{s.label}</span>
            </div>
            <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>To: <strong style={{ color: "var(--text-primary)" }}>{invoice.client_name}</strong>{invoice.client_email && ` · ${invoice.client_email}`}</p>
          </div>
          <div className="flex items-center gap-2">
            {invoice.status === "draft" && (
              <button onClick={() => onStatusChange("sent")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
                style={{ background: "#3b82f6" }}>
                <Send size={11}/> Mark as Sent
              </button>
            )}
            {invoice.status === "sent" && (
              <button onClick={() => onStatusChange("paid")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
                style={{ background: "#22c55e" }}>
                <CheckCircle2 size={11}/> Mark as Paid
              </button>
            )}
            <button onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-colors hover:bg-white/5"
              style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
              <Printer size={11}/> Print
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10" style={{ color: "var(--text-secondary)" }}><X size={14}/></button>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto max-h-[60vh]">
          {invoice.due_date && (
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>Due: <strong style={{ color: "var(--text-primary)" }}>{fmtDate(invoice.due_date)}</strong></p>
          )}
          {/* Line items */}
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b" style={{ borderColor: "var(--border)" }}>
                {["Description","Qty","Rate","Total"].map(h => (
                  <th key={h} className={`py-2 text-xs font-semibold ${h === "Total" || h === "Rate" || h === "Qty" ? "text-right" : "text-left"}`} style={{ color: "var(--text-secondary)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(invoice.items ?? []).map((item: InvoiceItem, i: number) => (
                <tr key={i} className="border-b" style={{ borderColor: "var(--border)" }}>
                  <td className="py-2.5" style={{ color: "var(--text-primary)" }}>{item.label}</td>
                  <td className="py-2.5 text-right text-xs font-mono" style={{ color: "var(--text-secondary)" }}>{item.qty}</td>
                  <td className="py-2.5 text-right text-xs font-mono" style={{ color: "var(--text-secondary)" }}>{fmt(item.rate)}</td>
                  <td className="py-2.5 text-right font-semibold font-mono" style={{ color: "var(--text-primary)" }}>{fmt(item.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {/* Totals */}
          <div className="ml-auto w-48 space-y-1">
            <div className="flex justify-between text-xs" style={{ color: "var(--text-secondary)" }}><span>Subtotal</span><span className="font-mono">{fmt(invoice.subtotal)}</span></div>
            {Number(invoice.tax_rate) > 0 && <div className="flex justify-between text-xs" style={{ color: "var(--text-secondary)" }}><span>Tax ({invoice.tax_rate}%)</span><span className="font-mono">{fmt(invoice.tax_amount)}</span></div>}
            <div className="flex justify-between text-sm font-bold border-t pt-1" style={{ color: "var(--text-primary)", borderColor: "var(--border)" }}><span>Total</span><span className="font-mono">{fmt(invoice.total)}</span></div>
          </div>
          {invoice.notes && (
            <div className="p-3 rounded-lg text-xs" style={{ background: "var(--bg-primary)", color: "var(--text-secondary)" }}>
              <strong style={{ color: "var(--text-primary)" }}>Notes:</strong> {invoice.notes}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
