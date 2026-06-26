"use client";
import { useState } from "react";
import { Plus, Target, ChevronDown, ChevronRight, Trash2, TrendingUp } from "lucide-react";

interface KeyResult { id: string; title: string; current: number; target: number; unit: string; }
interface Goal { id: string; title: string; description: string; dueDate: string; keyResults: KeyResult[]; expanded: boolean; }

const DEMO_GOALS: Goal[] = [
  {
    id: "g1", title: "Launch MVP by Q3", description: "Get the product to market with core features.", dueDate: "2026-09-30", expanded: true,
    keyResults: [
      { id: "kr1", title: "Complete core task management features", current: 80, target: 100, unit: "%" },
      { id: "kr2", title: "Onboard beta users", current: 12, target: 50, unit: "users" },
      { id: "kr3", title: "Achieve 95% uptime SLA", current: 97, target: 95, unit: "%" },
    ],
  },
  {
    id: "g2", title: "Grow to 100 teams", description: "Scale user base across SMBs and startups.", dueDate: "2026-12-31", expanded: false,
    keyResults: [
      { id: "kr4", title: "Sign 100 paying teams", current: 12, target: 100, unit: "teams" },
      { id: "kr5", title: "Reach $10k MRR", current: 2400, target: 10000, unit: "$" },
    ],
  },
];

function progress(krs: KeyResult[]) {
  if (!krs.length) return 0;
  return Math.round(krs.reduce((sum, kr) => sum + Math.min((kr.current / kr.target) * 100, 100), 0) / krs.length);
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
  const [goals, setGoals] = useState<Goal[]>(DEMO_GOALS);
  const [creating, setCreating] = useState(false);
  const [newGoal, setNewGoal] = useState({ title: "", description: "", dueDate: "" });

  function toggleExpand(id: string) {
    setGoals((gs) => gs.map((g) => g.id === id ? { ...g, expanded: !g.expanded } : g));
  }

  function deleteGoal(id: string) {
    setGoals((gs) => gs.filter((g) => g.id !== id));
  }

  function addGoal() {
    if (!newGoal.title.trim()) return;
    setGoals((gs) => [{
      id: `g${Date.now()}`, title: newGoal.title, description: newGoal.description,
      dueDate: newGoal.dueDate, keyResults: [], expanded: true,
    }, ...gs]);
    setNewGoal({ title: "", description: "", dueDate: "" });
    setCreating(false);
  }

  function updateKR(goalId: string, krId: string, patch: Partial<KeyResult>) {
    setGoals((gs) => gs.map((g) => g.id === goalId ? { ...g, keyResults: g.keyResults.map((kr) => kr.id === krId ? { ...kr, ...patch } : kr) } : g));
  }

  function addKR(goalId: string) {
    const title = prompt("Key result title:");
    if (!title?.trim()) return;
    const kr: KeyResult = { id: `kr${Date.now()}`, title: title.trim(), current: 0, target: 100, unit: "%" };
    setGoals((gs) => gs.map((g) => g.id === goalId ? { ...g, keyResults: [...g.keyResults, kr] } : g));
  }

  const totalProgress = goals.length ? Math.round(goals.reduce((s, g) => s + progress(g.keyResults), 0) / goals.length) : 0;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Goals</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>Track your team's objectives and key results</p>
        </div>
        <button onClick={() => setCreating(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90"
          style={{ background: "var(--accent-purple)" }}>
          <Plus size={14} /> New goal
        </button>
      </div>

      {/* Overall progress card */}
      <div className="rounded-xl p-4 mb-6 border flex items-center gap-6"
        style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
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

      {/* New goal form */}
      {creating && (
        <div className="rounded-xl p-4 mb-4 border" style={{ background: "var(--bg-secondary)", borderColor: "var(--accent-purple)" }}>
          <input autoFocus value={newGoal.title} onChange={(e) => setNewGoal((g) => ({ ...g, title: e.target.value }))}
            placeholder="Goal title..." className="w-full bg-transparent outline-none text-base font-semibold mb-2"
            style={{ color: "var(--text-primary)" }} />
          <input value={newGoal.description} onChange={(e) => setNewGoal((g) => ({ ...g, description: e.target.value }))}
            placeholder="Description (optional)" className="w-full bg-transparent outline-none text-sm mb-3"
            style={{ color: "var(--text-secondary)" }} />
          <div className="flex items-center gap-3">
            <div>
              <label className="text-xs mr-2" style={{ color: "var(--text-secondary)" }}>Due date</label>
              <input type="date" value={newGoal.dueDate} onChange={(e) => setNewGoal((g) => ({ ...g, dueDate: e.target.value }))}
                className="text-xs bg-transparent outline-none" style={{ color: "var(--text-primary)" }} />
            </div>
            <div className="flex gap-2 ml-auto">
              <button onClick={() => setCreating(false)} className="text-xs px-3 py-1.5 rounded-lg" style={{ color: "var(--text-secondary)" }}>Cancel</button>
              <button onClick={addGoal} className="text-xs px-3 py-1.5 rounded-lg text-white font-medium" style={{ background: "var(--accent-purple)" }}>Create goal</button>
            </div>
          </div>
        </div>
      )}

      {/* Goals list */}
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
                        {goal.dueDate && (
                          <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                            Due {new Date(goal.dueDate).toLocaleDateString()}
                          </span>
                        )}
                        <span className="text-xs font-bold" style={{ color: pct >= 100 ? "#22c55e" : "var(--accent-purple)" }}>{pct}%</span>
                        <button onClick={(e) => { e.stopPropagation(); deleteGoal(goal.id); }}
                          className="p-1 rounded hover:bg-red-500/10 transition-colors" style={{ color: "var(--danger)" }}>
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
                      const krPct = Math.min(Math.round((kr.current / kr.target) * 100), 100);
                      return (
                        <div key={kr.id}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs" style={{ color: "var(--text-primary)" }}>{kr.title}</span>
                            <div className="flex items-center gap-2">
                              <input type="number" value={kr.current}
                                onChange={(e) => updateKR(goal.id, kr.id, { current: Number(e.target.value) })}
                                onClick={(e) => e.stopPropagation()}
                                className="w-16 text-xs text-right bg-transparent outline-none"
                                style={{ color: "var(--text-primary)" }}
                              />
                              <span className="text-xs" style={{ color: "var(--text-secondary)" }}>/ {kr.target} {kr.unit}</span>
                              <span className="text-xs font-bold w-8 text-right" style={{ color: krPct >= 100 ? "#22c55e" : "var(--text-secondary)" }}>{krPct}%</span>
                            </div>
                          </div>
                          <ProgressBar value={krPct} size="sm" />
                        </div>
                      );
                    })}
                  </div>
                  <button onClick={() => addKR(goal.id)}
                    className="flex items-center gap-1 text-xs mt-3 hover:opacity-80 transition-opacity"
                    style={{ color: "var(--accent-purple)" }}>
                    <Plus size={12} /> Add key result
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
