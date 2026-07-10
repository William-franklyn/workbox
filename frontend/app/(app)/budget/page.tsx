"use client";
import { useEffect, useState, useCallback } from "react";
import {
  Plus, X, Loader2, Trash2, Edit3, DollarSign, TrendingUp,
  AlertCircle, CheckCircle, ChevronDown, ChevronRight,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Budget {
  id: string; name: string; description?: string; total_amount: number;
  currency?: string; period_start?: string; period_end?: string;
  status?: string; created_at: string;
}
interface BudgetItem {
  id: string; budget_id: string; category: string; description?: string;
  allocated: number; spent: number; created_at: string;
}

const CURRENCIES = ["USD", "EUR", "GBP", "NGN", "KES", "GHS", "ZAR", "JPY", "CNY", "CAD", "AUD"];
const BUDGET_STATUS = ["active", "closed", "draft"];
const ITEM_CATEGORIES = ["Personnel", "Technology", "Marketing", "Operations", "Travel", "Training", "Equipment", "Consulting", "Legal", "Facilities", "Miscellaneous"];

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

function Pct({ spent, allocated }: { spent: number; allocated: number }) {
  if (allocated <= 0) return null;
  const pct = Math.min(100, Math.round((spent / allocated) * 100));
  const over = spent > allocated;
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1" style={{ color: "var(--text-secondary)" }}>
        <span>{fmt(spent)} spent</span>
        <span style={{ color: over ? "var(--danger)" : "var(--text-muted)" }}>{pct}%</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
        <div className="h-full rounded-full transition-all"
          style={{ width: `${Math.min(100, pct)}%`, background: over ? "var(--danger)" : pct > 80 ? "var(--warning)" : "var(--accent-purple)" }} />
      </div>
    </div>
  );
}

const inputCls = "w-full text-sm px-3 py-2 rounded-lg border outline-none";
const inputStyle = { background: "var(--bg-primary)", borderColor: "var(--border)", color: "var(--text-primary)" };
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>{label}</label>{children}</div>;
}

// ─── Budget Form ──────────────────────────────────────────────────────────────

function BudgetForm({ initial, onSave, onClose }: { initial?: Budget; onSave: (b: Budget) => void; onClose: () => void }) {
  const [f, setF] = useState({
    name: initial?.name ?? "", description: initial?.description ?? "",
    total_amount: String(initial?.total_amount ?? ""), currency: initial?.currency ?? "USD",
    period_start: initial?.period_start ?? "", period_end: initial?.period_end ?? "",
    status: initial?.status ?? "active",
  });
  const [saving, setSaving] = useState(false);
  const upd = (k: string, v: string) => setF(p => ({ ...p, [k]: v }));

  async function save() {
    if (!f.name.trim()) return;
    setSaving(true);
    const body = { ...f, total_amount: parseFloat(f.total_amount) || 0, period_start: f.period_start || null, period_end: f.period_end || null };
    const res = await fetch("/api/budget", {
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
      <Field label="Budget name *"><input value={f.name} onChange={e => upd("name", e.target.value)} className={inputCls} style={inputStyle} /></Field>
      <Field label="Description"><textarea value={f.description} onChange={e => upd("description", e.target.value)} rows={2} className={`${inputCls} resize-none`} style={inputStyle} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Total amount">
          <input value={f.total_amount} onChange={e => upd("total_amount", e.target.value)} type="number" placeholder="0" className={inputCls} style={inputStyle} />
        </Field>
        <Field label="Currency">
          <select value={f.currency} onChange={e => upd("currency", e.target.value)} className={inputCls} style={inputStyle}>
            {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Period start"><input value={f.period_start} onChange={e => upd("period_start", e.target.value)} type="date" className={inputCls} style={inputStyle} /></Field>
        <Field label="Period end"><input value={f.period_end} onChange={e => upd("period_end", e.target.value)} type="date" className={inputCls} style={inputStyle} /></Field>
      </div>
      <Field label="Status">
        <select value={f.status} onChange={e => upd("status", e.target.value)} className={inputCls} style={inputStyle}>
          {BUDGET_STATUS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </Field>
      <div className="flex justify-end gap-2 pt-2">
        <button onClick={onClose} className="text-sm px-4 py-2 rounded-lg" style={{ color: "var(--text-secondary)" }}>Cancel</button>
        <button onClick={save} disabled={saving || !f.name.trim()}
          className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg font-medium disabled:opacity-50"
          style={{ background: "var(--accent-purple)", color: "#fff" }}>
          {saving && <Loader2 size={13} className="animate-spin" />} Save
        </button>
      </div>
    </div>
  );
}

// ─── Budget Item Form ─────────────────────────────────────────────────────────

function ItemForm({ budgetId, initial, onSave, onClose }: {
  budgetId: string; initial?: BudgetItem; onSave: (i: BudgetItem) => void; onClose: () => void;
}) {
  const [f, setF] = useState({
    category: initial?.category ?? "", description: initial?.description ?? "",
    allocated: String(initial?.allocated ?? ""), spent: String(initial?.spent ?? "0"),
  });
  const [saving, setSaving] = useState(false);
  const upd = (k: string, v: string) => setF(p => ({ ...p, [k]: v }));

  async function save() {
    if (!f.category.trim()) return;
    setSaving(true);
    const body = { type: "item", budget_id: budgetId, category: f.category, description: f.description, allocated: parseFloat(f.allocated) || 0, spent: parseFloat(f.spent) || 0 };
    const res = await fetch("/api/budget", {
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
      <Field label="Category *">
        <input value={f.category} onChange={e => upd("category", e.target.value)} list="cats" className={inputCls} style={inputStyle} />
        <datalist id="cats">{ITEM_CATEGORIES.map(c => <option key={c} value={c} />)}</datalist>
      </Field>
      <Field label="Description"><input value={f.description} onChange={e => upd("description", e.target.value)} className={inputCls} style={inputStyle} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Allocated"><input value={f.allocated} onChange={e => upd("allocated", e.target.value)} type="number" placeholder="0" className={inputCls} style={inputStyle} /></Field>
        <Field label="Spent so far"><input value={f.spent} onChange={e => upd("spent", e.target.value)} type="number" placeholder="0" className={inputCls} style={inputStyle} /></Field>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button onClick={onClose} className="text-sm px-4 py-2 rounded-lg" style={{ color: "var(--text-secondary)" }}>Cancel</button>
        <button onClick={save} disabled={saving || !f.category.trim()}
          className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg font-medium disabled:opacity-50"
          style={{ background: "var(--accent-purple)", color: "#fff" }}>
          {saving && <Loader2 size={13} className="animate-spin" />} Save
        </button>
      </div>
    </div>
  );
}

// ─── Budget Card ──────────────────────────────────────────────────────────────

function BudgetCard({ budget, onEdit, onDelete }: { budget: Budget; onEdit: () => void; onDelete: () => void }) {
  const [items, setItems] = useState<BudgetItem[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);
  const [addingItem, setAddingItem] = useState(false);
  const [editingItem, setEditingItem] = useState<BudgetItem | null>(null);

  async function loadItems() {
    if (items.length > 0) { setExpanded(e => !e); return; }
    setLoadingItems(true);
    const res = await fetch(`/api/budget?type=items&budget_id=${budget.id}`);
    const d = await res.json();
    setItems(Array.isArray(d) ? d : []);
    setLoadingItems(false);
    setExpanded(true);
  }

  async function deleteItem(id: string) {
    setItems(p => p.filter(i => i.id !== id));
    await fetch(`/api/budget?id=${id}&type=item`, { method: "DELETE" });
  }

  function handleSavedItem(item: BudgetItem) {
    setItems(p => { const i = p.findIndex(x => x.id === item.id); if (i >= 0) { const n = [...p]; n[i] = item; return n; } return [...p, item]; });
    setAddingItem(false); setEditingItem(null);
  }

  const totalAllocated = items.reduce((s, i) => s + i.allocated, 0);
  const totalSpent = items.reduce((s, i) => s + i.spent, 0);
  const remaining = budget.total_amount - totalSpent;
  const utilization = budget.total_amount > 0 ? Math.round((totalSpent / budget.total_amount) * 100) : 0;

  return (
    <div className="rounded-xl border overflow-hidden" style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
      {/* Header */}
      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>{budget.name}</h3>
              <span className="text-xs px-2 py-0.5 rounded-full capitalize"
                style={{ background: "rgba(255,255,255,0.08)", color: "var(--text-secondary)" }}>{budget.status}</span>
            </div>
            {budget.description && <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>{budget.description}</p>}
            {(budget.period_start || budget.period_end) && (
              <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                {budget.period_start ?? "—"} → {budget.period_end ?? "—"}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={onEdit} className="p-1.5 rounded hover:bg-white/5" style={{ color: "var(--text-secondary)" }}><Edit3 size={13} /></button>
            <button onClick={onDelete} className="p-1.5 rounded hover:bg-red-500/10" style={{ color: "var(--danger)" }}><Trash2 size={13} /></button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="rounded-lg p-3" style={{ background: "var(--bg-primary)" }}>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>Total</p>
            <p className="text-sm font-bold mt-0.5" style={{ color: "var(--text-primary)" }}>{fmt(budget.total_amount, budget.currency)}</p>
          </div>
          <div className="rounded-lg p-3" style={{ background: "var(--bg-primary)" }}>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>Spent</p>
            <p className="text-sm font-bold mt-0.5" style={{ color: "var(--text-primary)" }}>{fmt(totalSpent, budget.currency)}</p>
          </div>
          <div className="rounded-lg p-3" style={{ background: "var(--bg-primary)" }}>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>Remaining</p>
            <p className="text-sm font-bold mt-0.5" style={{ color: remaining < 0 ? "var(--danger)" : "var(--text-primary)" }}>{fmt(remaining, budget.currency)}</p>
          </div>
        </div>

        <Pct spent={totalSpent} allocated={budget.total_amount} />
      </div>

      {/* Line items toggle */}
      <div className="border-t" style={{ borderColor: "var(--border)" }}>
        <button onClick={loadItems}
          className="w-full flex items-center gap-2 px-5 py-3 text-xs font-medium hover:bg-white/3 transition-colors"
          style={{ color: "var(--text-secondary)" }}>
          {loadingItems ? <Loader2 size={12} className="animate-spin" /> : expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          {items.length > 0 ? `${items.length} line items` : "View / add line items"}
        </button>

        {expanded && (
          <div className="px-5 pb-4">
            {addingItem && (
              <div className="mb-3 p-3 rounded-lg border" style={{ borderColor: "var(--border)", background: "var(--bg-primary)" }}>
                <ItemForm budgetId={budget.id} onSave={handleSavedItem} onClose={() => setAddingItem(false)} />
              </div>
            )}
            {editingItem && (
              <div className="mb-3 p-3 rounded-lg border" style={{ borderColor: "var(--border)", background: "var(--bg-primary)" }}>
                <ItemForm budgetId={budget.id} initial={editingItem} onSave={handleSavedItem} onClose={() => setEditingItem(null)} />
              </div>
            )}
            {items.length === 0 && !addingItem ? (
              <p className="text-xs text-center py-3" style={{ color: "var(--text-muted)" }}>No line items yet</p>
            ) : items.map(item => (
              <div key={item.id} className="py-2.5 border-b last:border-0" style={{ borderColor: "var(--border)" }}>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div>
                    <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>{item.category}</span>
                    {item.description && <span className="text-xs ml-2" style={{ color: "var(--text-muted)" }}>{item.description}</span>}
                  </div>
                  <div className="flex items-center gap-2 text-xs shrink-0" style={{ color: "var(--text-secondary)" }}>
                    <span>{fmt(item.spent, budget.currency)} / {fmt(item.allocated, budget.currency)}</span>
                    <button onClick={() => setEditingItem(item)} className="p-1 rounded hover:bg-white/5" style={{ color: "var(--text-secondary)" }}><Edit3 size={11} /></button>
                    <button onClick={() => deleteItem(item.id)} className="p-1 rounded hover:bg-red-500/10" style={{ color: "var(--danger)" }}><Trash2 size={11} /></button>
                  </div>
                </div>
                <Pct spent={item.spent} allocated={item.allocated} />
              </div>
            ))}
            {!addingItem && !editingItem && (
              <button onClick={() => setAddingItem(true)}
                className="mt-2 w-full text-xs py-2 rounded-lg border hover:opacity-80"
                style={{ borderColor: "var(--border)", borderStyle: "dashed", color: "var(--text-secondary)" }}>
                + Add line item
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function BudgetPage() {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Budget | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/budget").then(r => r.json()).then(d => setBudgets(Array.isArray(d) ? d : [])).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function deleteBudget(id: string) {
    if (!confirm("Delete this budget? All line items will also be removed.")) return;
    setBudgets(p => p.filter(b => b.id !== id));
    await fetch(`/api/budget?id=${id}`, { method: "DELETE" });
  }

  function handleSaved(b: Budget) {
    setBudgets(p => { const i = p.findIndex(x => x.id === b.id); if (i >= 0) { const n = [...p]; n[i] = b; return n; } return [b, ...p]; });
    setModal(false); setEditing(null);
  }

  const totalBudgeted = budgets.reduce((s, b) => s + b.total_amount, 0);

  return (
    <>
      {(modal || editing) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.75)" }}>
          <div className="w-full max-w-lg rounded-2xl border shadow-2xl flex flex-col max-h-[85vh]"
            style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
            <div className="flex items-center justify-between px-5 py-4 border-b shrink-0" style={{ borderColor: "var(--border)" }}>
              <span className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>{editing ? "Edit budget" : "New budget"}</span>
              <button onClick={() => { setModal(false); setEditing(null); }} className="p-1 rounded hover:bg-white/5" style={{ color: "var(--text-secondary)" }}><X size={16} /></button>
            </div>
            <div className="overflow-y-auto flex-1 p-5">
              <BudgetForm initial={editing ?? undefined} onSave={handleSaved} onClose={() => { setModal(false); setEditing(null); }} />
            </div>
          </div>
        </div>
      )}

      <div className="p-6 max-w-5xl mx-auto overflow-y-auto h-full">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Budget Tracker</h1>
            <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
              {budgets.length} budget{budgets.length !== 1 ? "s" : ""} · Total budgeted: <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{fmt(totalBudgeted)}</span>
            </p>
          </div>
          <button onClick={() => { setEditing(null); setModal(true); }}
            className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg font-medium"
            style={{ background: "var(--accent-purple)", color: "#fff" }}>
            <Plus size={14} /> New Budget
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 size={22} className="animate-spin" style={{ color: "var(--text-secondary)" }} /></div>
        ) : budgets.length === 0 ? (
          <div className="rounded-2xl border text-center py-20" style={{ borderColor: "var(--border)", borderStyle: "dashed" }}>
            <DollarSign size={36} className="mx-auto mb-4" style={{ color: "var(--text-muted)" }} />
            <h2 className="text-lg font-semibold mb-2" style={{ color: "var(--text-primary)" }}>No budgets yet</h2>
            <p className="text-sm mb-6 max-w-sm mx-auto" style={{ color: "var(--text-secondary)" }}>
              Track project budgets, department spend, grants, and campaign costs. Add line items to see exactly where money is going.
            </p>
            <button onClick={() => setModal(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold"
              style={{ background: "var(--accent-purple)", color: "#fff" }}>
              <Plus size={15} /> Create first budget
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {budgets.map(b => (
              <BudgetCard key={b.id} budget={b}
                onEdit={() => { setEditing(b); setModal(true); }}
                onDelete={() => deleteBudget(b.id)} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
