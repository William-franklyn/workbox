"use client";
import { useEffect, useState } from "react";
import { Plus, Target, ChevronDown, ChevronRight, Trash2, TrendingUp, Loader2 } from "lucide-react";

interface KeyResult { id: string; goal_id: string; title: string; current_value: number; target_value: number; unit: string; }
interface Goal { id: string; title: string; description: string; due_date: string; expanded: boolean; keyResults: KeyResult[]; }

function progress(krs: KeyResult[]) {
  if (!krs.length) return 0;
  return Math.round(krs.reduce((s, kr) => s + Math.min((kr.current_value / kr.target_value) * 100, 100), 0) / krs.length);
}

function ProgressBar({ value, size = "md" }: { value: number; size?: "sm" | "md" }) {
  const h = size === "sm" ? "h-1" : "h-2";
  const color = value >= 100 ? "#22c55e" : value >= 60 ? "#3b82f6" : value >= 30 ? "#f59e0b" : "#ef4444";
  return (
    <div className={`w-full ${h} rounded-full overflow-hidden`} style={{ background: "var(--bg-primary)" }}>
      <div className={`${h} rounded-full transition-all`} style={{ width: `${Math.min(value, 100)}%`, background: color }} />
    </div>
  );
}

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newGoal, setNewGoal] = useState({ title: "", description: "", due_date: "" });

  useEffect(() => {
    fetch("/api/goals").then((r) => r.json()).then(({ goals: gs, keyResults: krs }) => {
      if (!Array.isArray(gs)) return;
      setGoals(gs.map((g: any) => ({ ...g, expanded: true, keyResults: krs.filter((kr: KeyResult) => kr.goal_id === g.id) })));
    }).finally(() => setLoading(false));
  }, []);

  async function addGoal() {
    if (!newGoal.title.trim()) return;
    const res = await fetch("/api/goals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "goal", id: `g${Date.now()}`, ...newGoal }) });
    const saved = res.ok ? await res.json() : { id: `g${Date.now()}`, ...newGoal };
    setGoals((gs) => [{ ...saved, expanded: true, keyResults: [] }, ...gs]);
    setNewGoal({ title: "", description: "", due_date: "" });
    setCreating(false);
  }

  async function deleteGoal(id: string) {
    setGoals((gs) => gs.filter((g) => g.id !== id));
    await fetch("/api/goals", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, type: "goal" }) });
  }

  async function addKR(goalId: string) {
    const title = prompt("Key result title:");
    if (!title?.trim()) return;
    const kr = { id: `kr${Date.now()}`, goal_id: goalId, title: title.trim(), current_value: 0, target_value: 100, unit: "%" };
    const res = await fetch("/api/goals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "kr", ...kr }) });
    const saved = res.ok ? await res.json() : kr;
    setGoals((gs) => gs.map((g) => g.id === goalId ? { ...g, keyResults: [...g.keyResults, saved] } : g));
  }

  async function updateKR(goalId: string, krId: string, patch: Partial<KeyResult>) {
    setGoals((gs) => gs.map((g) => g.id === goalId ? { ...g, keyResults: g.keyResults.map((kr) => kr.id === krId ? { ...kr, ...patch } : kr) } : g));
    await fetch("/api/goals", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: krId, type: "kr", ...patch }) });
  }

  function toggleExpand(id: string) {
    setGoals((gs) => gs.map((g) => g.id === id ? { ...g, expanded: !g.expanded } : g));
  }

  const totalProgress = goals.length ? Math.round(goals.reduce((s, g) => s + progress(g.keyResults), 0) / goals.length) : 0;

  return (
    <div className="p-6 max-w-3xl mx-auto overflow-y-auto h-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Goals</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>Track your team's objectives and key results</p>
        </div>
        <button onClick={() => setCreating(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90" style={{ background: "var(--accent-purple)" }}>
          <Plus size={14} /> New goal
        </button>
      </div>

      {/* Overall progress */}
      <div className="rounded-xl p-4 mb-6 border flex items-center gap-6" style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
        <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: "rgba(124,58,237,0.15)" }}>
          <TrendingUp size={20} style={{ color: "var(--accent-purple)" }} />
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Overall progress</span>
            <span className="text-sm font-bold" style={{ color: "var(--accent-purple)" }}>{totalProgress}%</span>
          </div>
          <ProgressBar value={totalProgress} />
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>{goals.length}</p>
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>Active goals</p>
        </div>
      </div>

      {/* Create form */}
      {creating && (
        <div className="rounded-xl p-4 mb-4 border" style={{ background: "var(--bg-secondary)", borderColor: "var(--accent-purple)" }}>
          <input autoFocus value={newGoal.title} onChange={(e) => setNewGoal((g) => ({ ...g, title: e.target.value }))}
            placeholder="Goal title..." className="w-full bg-transparent outline-none text-base font-semibold mb-2" style={{ color: "var(--text-primary)" }} />
          <input value={newGoal.description} onChange={(e) => setNewGoal((g) => ({ ...g, description: e.target.value }))}
            placeholder="Description (optional)" className="w-full bg-transparent outline-none text-sm mb-3" style={{ color: "var(--text-secondary)" }} />
          <div className="flex items-center gap-3">
            <label className="text-xs" style={{ color: "var(--text-secondary)" }}>Due date
              <input type="date" value={newGoal.due_date} onChange={(e) => setNewGoal((g) => ({ ...g, due_date: e.target.value }))}
                className="ml-2 text-xs bg-transparent outline-none" style={{ color: "var(--text-primary)" }} />
            </label>
            <div className="flex gap-2 ml-auto">
              <button onClick={() => setCreating(false)} className="text-xs px-3 py-1.5 rounded-lg" style={{ color: "var(--text-secondary)" }}>Cancel</button>
              <button onClick={addGoal} className="text-xs px-3 py-1.5 rounded-lg text-white font-medium" style={{ background: "var(--accent-purple)" }}>Create goal</button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={20} className="animate-spin" style={{ color: "var(--text-secondary)" }} /></div>
      ) : (
        <div className="space-y-3">
          {goals.map((goal) => {
            const pct = progress(goal.keyResults);
            return (
              <div key={goal.id} className="rounded-xl border overflow-hidden" style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
                <div className="p-4 cursor-pointer" onClick={() => toggleExpand(goal.id)}>
                  <div className="flex items-start gap-3">
                    <button className="mt-0.5" style={{ color: "var(--text-secondary)" }}>
                      {goal.expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                    </button>
                    <Target size={16} className="mt-0.5 flex-shrink-0" style={{ color: "var(--accent-purple)" }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>{goal.title}</h3>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {goal.due_date && <span className="text-xs" style={{ color: "var(--text-secondary)" }}>Due {new Date(goal.due_date).toLocaleDateString()}</span>}
                          <span className="text-xs font-bold" style={{ color: pct >= 100 ? "#22c55e" : "var(--accent-purple)" }}>{pct}%</span>
                          <button onClick={(e) => { e.stopPropagation(); deleteGoal(goal.id); }} className="p-1 rounded hover:bg-red-500/10" style={{ color: "var(--danger)" }}>
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                      {goal.description && <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>{goal.description}</p>}
                      <div className="mt-2"><ProgressBar value={pct} /></div>
                    </div>
                  </div>
                </div>

                {goal.expanded && (
                  <div className="border-t px-4 pb-3" style={{ borderColor: "var(--border)" }}>
                    <p className="text-xs font-semibold uppercase tracking-wide mt-3 mb-2" style={{ color: "var(--text-secondary)" }}>Key Results</p>
                    <div className="space-y-3">
                      {goal.keyResults.map((kr) => {
                        const krPct = Math.min(Math.round((kr.current_value / kr.target_value) * 100), 100);
                        return (
                          <div key={kr.id}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs" style={{ color: "var(--text-primary)" }}>{kr.title}</span>
                              <div className="flex items-center gap-2">
                                <input type="number" value={kr.current_value}
                                  onChange={(e) => updateKR(goal.id, kr.id, { current_value: Number(e.target.value) })}
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-16 text-xs text-right bg-transparent outline-none" style={{ color: "var(--text-primary)" }}
                                />
                                <span className="text-xs" style={{ color: "var(--text-secondary)" }}>/ {kr.target_value} {kr.unit}</span>
                                <span className="text-xs font-bold w-8 text-right" style={{ color: krPct >= 100 ? "#22c55e" : "var(--text-secondary)" }}>{krPct}%</span>
                              </div>
                            </div>
                            <ProgressBar value={krPct} size="sm" />
                          </div>
                        );
                      })}
                    </div>
                    <button onClick={() => addKR(goal.id)} className="flex items-center gap-1 text-xs mt-3 hover:opacity-80" style={{ color: "var(--accent-purple)" }}>
                      <Plus size={12} /> Add key result
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          {goals.length === 0 && !creating && (
            <div className="text-center py-16 rounded-xl border" style={{ borderColor: "var(--border)" }}>
              <Target size={32} className="mx-auto mb-3 opacity-20" style={{ color: "var(--text-secondary)" }} />
              <p className="text-sm font-medium mb-1" style={{ color: "var(--text-primary)" }}>No goals yet</p>
              <p className="text-xs mb-4" style={{ color: "var(--text-secondary)" }}>Set your first goal to track progress</p>
              <button onClick={() => setCreating(true)} className="text-xs px-4 py-2 rounded-lg text-white" style={{ background: "var(--accent-purple)" }}>Create goal</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
