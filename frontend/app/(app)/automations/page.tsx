"use client";
import { useState } from "react";
import { Plus, Zap, Trash2, ToggleLeft, ToggleRight, ChevronRight } from "lucide-react";

interface Automation {
  id: string;
  name: string;
  trigger_type: string;
  trigger_value: string;
  action_type: string;
  action_value: string;
  enabled: boolean;
  run_count: number;
}

const TRIGGERS = [
  { value: "status_change", label: "Task status changes" },
  { value: "task_created", label: "Task is created" },
  { value: "due_date_passed", label: "Due date passes" },
  { value: "priority_change", label: "Priority changes to" },
  { value: "assignee_change", label: "Assignee changes" },
];

const ACTIONS = [
  { value: "set_status", label: "Set status to" },
  { value: "set_priority", label: "Set priority to" },
  { value: "send_notification", label: "Send notification" },
  { value: "assign_to", label: "Assign to" },
  { value: "move_to_list", label: "Move to list" },
];

const DEMO_AUTOMATIONS: Automation[] = [
  { id: "a1", name: "Auto-close done tasks", trigger_type: "status_change", trigger_value: "done", action_type: "send_notification", action_value: "Task completed!", enabled: true, run_count: 14 },
  { id: "a2", name: "Escalate overdue to urgent", trigger_type: "due_date_passed", trigger_value: "", action_type: "set_priority", action_value: "urgent", enabled: true, run_count: 3 },
  { id: "a3", name: "Notify on high priority", trigger_type: "priority_change", trigger_value: "high", action_type: "send_notification", action_value: "High priority task!", enabled: false, run_count: 0 },
];

function TriggerLabel({ type, value }: { type: string; value: string }) {
  const t = TRIGGERS.find((x) => x.value === type);
  return <span>{t?.label ?? type}{value ? ` → ${value}` : ""}</span>;
}

function ActionLabel({ type, value }: { type: string; value: string }) {
  const a = ACTIONS.find((x) => x.value === type);
  return <span>{a?.label ?? type}{value ? ` "${value}"` : ""}</span>;
}

export default function AutomationsPage() {
  const [automations, setAutomations] = useState<Automation[]>(DEMO_AUTOMATIONS);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", trigger_type: "status_change", trigger_value: "", action_type: "send_notification", action_value: "" });

  function toggle(id: string) {
    setAutomations((as) => as.map((a) => a.id === id ? { ...a, enabled: !a.enabled } : a));
  }

  function remove(id: string) {
    setAutomations((as) => as.filter((a) => a.id !== id));
  }

  function create() {
    if (!form.name.trim()) return;
    setAutomations((as) => [{
      id: `a${Date.now()}`, ...form, enabled: true, run_count: 0,
    }, ...as]);
    setForm({ name: "", trigger_type: "status_change", trigger_value: "", action_type: "send_notification", action_value: "" });
    setCreating(false);
  }

  const active = automations.filter((a) => a.enabled).length;
  const totalRuns = automations.reduce((s, a) => s + a.run_count, 0);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Automations</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
            {active} active · {totalRuns} total runs
          </p>
        </div>
        <button onClick={() => setCreating(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90"
          style={{ background: "var(--accent-purple)" }}>
          <Plus size={14} /> New automation
        </button>
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

      {/* Create form */}
      {creating && (
        <div className="rounded-xl p-5 mb-4 border" style={{ background: "var(--bg-secondary)", borderColor: "var(--accent-purple)" }}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>New automation</h3>
          <div className="space-y-3">
            <div>
              <label className="text-xs mb-1.5 block" style={{ color: "var(--text-secondary)" }}>Name</label>
              <input autoFocus value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Automation name..."
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{ background: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs mb-1.5 block" style={{ color: "var(--text-secondary)" }}>When...</label>
                <select value={form.trigger_type} onChange={(e) => setForm((f) => ({ ...f, trigger_type: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ background: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }}>
                  {TRIGGERS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs mb-1.5 block" style={{ color: "var(--text-secondary)" }}>Value (optional)</label>
                <input value={form.trigger_value} onChange={(e) => setForm((f) => ({ ...f, trigger_value: e.target.value }))}
                  placeholder="e.g. done, urgent..."
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ background: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs mb-1.5 block" style={{ color: "var(--text-secondary)" }}>Then...</label>
                <select value={form.action_type} onChange={(e) => setForm((f) => ({ ...f, action_type: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ background: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }}>
                  {ACTIONS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs mb-1.5 block" style={{ color: "var(--text-secondary)" }}>Value</label>
                <input value={form.action_value} onChange={(e) => setForm((f) => ({ ...f, action_value: e.target.value }))}
                  placeholder="e.g. done, @user..."
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ background: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }} />
              </div>
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <button onClick={() => setCreating(false)} className="text-xs px-3 py-1.5 rounded-lg" style={{ color: "var(--text-secondary)" }}>Cancel</button>
            <button onClick={create} className="text-xs px-4 py-1.5 rounded-lg text-white font-medium" style={{ background: "var(--accent-purple)" }}>
              Create automation
            </button>
          </div>
        </div>
      )}

      {/* List */}
      <div className="space-y-2">
        {automations.map((a) => (
          <div key={a.id} className="rounded-xl border p-4 flex items-center gap-4"
            style={{ background: "var(--bg-secondary)", borderColor: "var(--border)", opacity: a.enabled ? 1 : 0.6 }}>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: a.enabled ? "rgba(124,58,237,0.15)" : "var(--bg-primary)" }}>
              <Zap size={16} style={{ color: a.enabled ? "var(--accent-purple)" : "var(--text-secondary)" }} />
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{a.name}</p>
              <div className="flex items-center gap-1 text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                <TriggerLabel type={a.trigger_type} value={a.trigger_value} />
                <ChevronRight size={11} />
                <ActionLabel type={a.action_type} value={a.action_value} />
              </div>
            </div>

            <div className="flex items-center gap-3 flex-shrink-0">
              {a.run_count > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full"
                  style={{ background: "var(--bg-primary)", color: "var(--text-secondary)" }}>
                  {a.run_count} runs
                </span>
              )}
              <button onClick={() => toggle(a.id)} style={{ color: a.enabled ? "var(--accent-purple)" : "var(--text-secondary)" }}>
                {a.enabled ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
              </button>
              <button onClick={() => remove(a.id)} className="p-1 rounded hover:bg-red-500/10 transition-colors" style={{ color: "var(--danger)" }}>
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}

        {automations.length === 0 && (
          <div className="text-center py-16 rounded-xl border" style={{ borderColor: "var(--border)" }}>
            <Zap size={32} className="mx-auto mb-3 opacity-20" style={{ color: "var(--text-secondary)" }} />
            <p className="text-sm font-medium mb-1" style={{ color: "var(--text-primary)" }}>No automations yet</p>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>Create your first rule to automate repetitive work</p>
          </div>
        )}
      </div>
    </div>
  );
}
