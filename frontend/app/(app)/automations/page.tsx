"use client";
import { useState, useEffect } from "react";
import { Plus, Zap, Trash2, ToggleLeft, ToggleRight, ChevronRight, Loader2, Play, RefreshCw } from "lucide-react";

interface Automation {
  id: string;
  name: string;
  trigger_type: string;
  trigger_value: string;
  action_type: string;
  action_value: string;
  enabled: boolean;
  run_count: number;
  created_at: string;
}

const TRIGGERS = [
  { value: "status_change", label: "Task status changes to", hasValue: true, valueOptions: ["todo", "in_progress", "in_review", "done"] },
  { value: "task_created", label: "A task is created", hasValue: false },
  { value: "due_date_passed", label: "Due date passes", hasValue: false },
  { value: "priority_change", label: "Priority changes to", hasValue: true, valueOptions: ["urgent", "high", "normal", "low"] },
  { value: "assignee_change", label: "Assignee changes", hasValue: false },
];

const ACTIONS = [
  { value: "set_status", label: "Set status to", hasValue: true, valueOptions: ["todo", "in_progress", "in_review", "done"] },
  { value: "set_priority", label: "Set priority to", hasValue: true, valueOptions: ["urgent", "high", "normal", "low"] },
  { value: "send_notification", label: "Send notification", hasValue: true },
  { value: "assign_to", label: "Assign to (email)", hasValue: true },
  { value: "move_to_list", label: "Move to list (name)", hasValue: true },
];

const TEMPLATES = [
  { name: "Escalate overdue tasks", trigger_type: "due_date_passed", trigger_value: "", action_type: "set_priority", action_value: "urgent" },
  { name: "Notify on done", trigger_type: "status_change", trigger_value: "done", action_type: "send_notification", action_value: "A task was completed! 🎉" },
  { name: "Auto-notify on creation", trigger_type: "task_created", trigger_value: "", action_type: "send_notification", action_value: "New task added to your workspace" },
  { name: "Flag urgent priority", trigger_type: "priority_change", trigger_value: "urgent", action_type: "send_notification", action_value: "🚨 Urgent task needs attention" },
];

function TriggerLabel({ type, value }: { type: string; value: string }) {
  const t = TRIGGERS.find((x) => x.value === type);
  return <span>{t?.label ?? type}{value ? ` "${value}"` : ""}</span>;
}
function ActionLabel({ type, value }: { type: string; value: string }) {
  const a = ACTIONS.find((x) => x.value === type);
  return <span>{a?.label ?? type}{value ? ` "${value}"` : ""}</span>;
}

const EMPTY_FORM = { name: "", trigger_type: "status_change", trigger_value: "done", action_type: "send_notification", action_value: "" };

export default function AutomationsPage() {
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [runningCheck, setRunningCheck] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/automations");
      const data = await res.json();
      setAutomations(data.automations ?? []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function toggle(auto: Automation) {
    const updated = { ...auto, enabled: !auto.enabled };
    setAutomations((as) => as.map((a) => a.id === auto.id ? updated : a));
    await fetch("/api/automations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: auto.id, enabled: !auto.enabled }),
    });
  }

  async function remove(id: string) {
    setAutomations((as) => as.filter((a) => a.id !== id));
    await fetch(`/api/automations?id=${id}`, { method: "DELETE" });
  }

  async function create(overrides?: Partial<typeof form>) {
    const data = { ...form, ...overrides };
    if (!data.name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/automations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (json.automation) {
        setAutomations((as) => [json.automation, ...as]);
        setForm(EMPTY_FORM);
        setCreating(false);
      }
    } finally { setSaving(false); }
  }

  async function runDueDateCheck() {
    setRunningCheck(true);
    try {
      await fetch("/api/automations/run");
      await load();
    } finally { setRunningCheck(false); }
  }

  const active = automations.filter((a) => a.enabled).length;
  const totalRuns = automations.reduce((s, a) => s + (a.run_count ?? 0), 0);
  const triggerDef = TRIGGERS.find((t) => t.value === form.trigger_type);
  const actionDef = ACTIONS.find((a) => a.value === form.action_type);

  return (
    <div className="overflow-y-auto h-full p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Automations</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
            {active} active · {totalRuns} total runs
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={runDueDateCheck} disabled={runningCheck}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs border transition-colors hover:bg-white/5 disabled:opacity-50"
            style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
            {runningCheck ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            Run due-date checks
          </button>
          <button onClick={() => setCreating(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90"
            style={{ background: "var(--accent-purple)" }}>
            <Plus size={14} /> New automation
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: "Total automations", value: automations.length },
          { label: "Active", value: active },
          { label: "Total runs", value: totalRuns },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl p-4 border text-center" style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
            <p className="text-2xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>{value}</p>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{label}</p>
          </div>
        ))}
      </div>

      {/* Quick templates */}
      {automations.length === 0 && !creating && !loading && (
        <div className="mb-6">
          <p className="text-xs font-medium mb-2" style={{ color: "var(--text-secondary)" }}>Quick templates</p>
          <div className="grid grid-cols-2 gap-2">
            {TEMPLATES.map((tpl) => (
              <button key={tpl.name} onClick={() => create({ ...tpl, name: tpl.name })}
                className="text-left p-3 rounded-xl border transition-colors hover:border-purple-500/40 hover:bg-white/5"
                style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
                <div className="flex items-center gap-2 mb-1">
                  <Zap size={12} style={{ color: "var(--accent-purple)" }} />
                  <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>{tpl.name}</span>
                </div>
                <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                  <TriggerLabel type={tpl.trigger_type} value={tpl.trigger_value} /> → <ActionLabel type={tpl.action_type} value={tpl.action_value} />
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Create form */}
      {creating && (
        <div className="rounded-xl p-5 mb-4 border" style={{ background: "var(--bg-secondary)", borderColor: "var(--accent-purple)" }}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>New automation</h3>
          <div className="space-y-3">
            <div>
              <label className="text-xs mb-1.5 block" style={{ color: "var(--text-secondary)" }}>Name</label>
              <input autoFocus value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                onKeyDown={(e) => e.key === "Enter" && create()}
                placeholder="e.g. Escalate overdue tasks"
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{ background: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs mb-1.5 block" style={{ color: "var(--text-secondary)" }}>When…</label>
                <select value={form.trigger_type} onChange={(e) => setForm((f) => ({ ...f, trigger_type: e.target.value, trigger_value: "" }))}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ background: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }}>
                  {TRIGGERS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              {triggerDef?.hasValue && (
                <div>
                  <label className="text-xs mb-1.5 block" style={{ color: "var(--text-secondary)" }}>Trigger value</label>
                  {triggerDef.valueOptions ? (
                    <select value={form.trigger_value} onChange={(e) => setForm((f) => ({ ...f, trigger_value: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                      style={{ background: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }}>
                      {triggerDef.valueOptions.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input value={form.trigger_value} onChange={(e) => setForm((f) => ({ ...f, trigger_value: e.target.value }))}
                      placeholder="Value..."
                      className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                      style={{ background: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }} />
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs mb-1.5 block" style={{ color: "var(--text-secondary)" }}>Then…</label>
                <select value={form.action_type} onChange={(e) => setForm((f) => ({ ...f, action_type: e.target.value, action_value: "" }))}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ background: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }}>
                  {ACTIONS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
                </select>
              </div>
              {actionDef?.hasValue && (
                <div>
                  <label className="text-xs mb-1.5 block" style={{ color: "var(--text-secondary)" }}>Action value</label>
                  {actionDef.valueOptions ? (
                    <select value={form.action_value} onChange={(e) => setForm((f) => ({ ...f, action_value: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                      style={{ background: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }}>
                      {actionDef.valueOptions.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input value={form.action_value} onChange={(e) => setForm((f) => ({ ...f, action_value: e.target.value }))}
                      placeholder={form.action_type === "send_notification" ? "Notification message..." : form.action_type === "assign_to" ? "user@email.com" : "Value..."}
                      className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                      style={{ background: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }} />
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <button onClick={() => { setCreating(false); setForm(EMPTY_FORM); }}
              className="text-xs px-3 py-1.5 rounded-lg transition-colors hover:bg-white/5"
              style={{ color: "var(--text-secondary)" }}>Cancel</button>
            <button onClick={() => create()} disabled={saving || !form.name.trim()}
              className="flex items-center gap-1.5 text-xs px-4 py-1.5 rounded-lg text-white font-medium disabled:opacity-50"
              style={{ background: "var(--accent-purple)" }}>
              {saving && <Loader2 size={11} className="animate-spin" />}
              Create automation
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={20} className="animate-spin" style={{ color: "var(--text-secondary)" }} /></div>
      ) : (
        <div className="space-y-2">
          {automations.map((a) => (
            <div key={a.id} className="rounded-xl border p-4 flex items-center gap-4 transition-opacity"
              style={{ background: "var(--bg-secondary)", borderColor: "var(--border)", opacity: a.enabled ? 1 : 0.55 }}>
              <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: a.enabled ? "rgba(124,58,237,0.15)" : "var(--bg-primary)" }}>
                <Zap size={16} style={{ color: a.enabled ? "var(--accent-purple)" : "var(--text-secondary)" }} />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{a.name}</p>
                <div className="flex items-center gap-1 text-xs mt-0.5 flex-wrap" style={{ color: "var(--text-secondary)" }}>
                  <TriggerLabel type={a.trigger_type} value={a.trigger_value} />
                  <ChevronRight size={11} />
                  <ActionLabel type={a.action_type} value={a.action_value} />
                </div>
              </div>

              <div className="flex items-center gap-3 flex-shrink-0">
                {(a.run_count ?? 0) > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--bg-primary)", color: "var(--text-secondary)" }}>
                    {a.run_count} runs
                  </span>
                )}
                <button onClick={() => toggle(a)} title={a.enabled ? "Disable" : "Enable"}
                  style={{ color: a.enabled ? "var(--accent-purple)" : "var(--text-secondary)" }}>
                  {a.enabled ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                </button>
                <button onClick={() => remove(a.id)} className="p-1 rounded hover:bg-red-500/10 transition-colors" style={{ color: "var(--danger)" }}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}

          {automations.length === 0 && !creating && (
            <div className="text-center py-16 rounded-xl border" style={{ borderColor: "var(--border)" }}>
              <Zap size={32} className="mx-auto mb-3 opacity-20" style={{ color: "var(--text-secondary)" }} />
              <p className="text-sm font-medium mb-1" style={{ color: "var(--text-primary)" }}>No automations yet</p>
              <p className="text-xs mb-4" style={{ color: "var(--text-secondary)" }}>Create your first rule to automate repetitive work</p>
              <button onClick={() => setCreating(true)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white"
                style={{ background: "var(--accent-purple)" }}>
                <Plus size={14} className="inline mr-1.5" />Create automation
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
