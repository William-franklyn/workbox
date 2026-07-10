"use client";
import { useEffect, useRef, useState } from "react";
import { Plus, Target, ChevronDown, ChevronRight, Trash2, TrendingUp, Loader2, Users, Lock, UserPlus } from "lucide-react";
import { track } from "@/lib/analytics";

interface KeyResult { id: string; goal_id: string; title: string; current_value: number; target_value: number; unit: string; }
interface GoalMember { goal_id: string; user_id: string; full_name: string; }
interface Goal {
  id: string; title: string; description: string; due_date: string;
  visibility: "private" | "team"; created_by: string;
  expanded: boolean; keyResults: KeyResult[];
}
interface OrgMember { id: string; full_name: string; role: string; }

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

function Avatar({ name, title }: { name: string; title?: string }) {
  return (
    <span title={title ?? name}
      className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 -ml-1 first:ml-0 ring-1"
      style={{ background: "var(--accent-purple)", ["--tw-ring-color" as string]: "var(--bg-secondary)" }}>
      {name?.[0]?.toUpperCase() ?? "?"}
    </span>
  );
}

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [members, setMembers] = useState<GoalMember[]>([]);
  const [me, setMe] = useState<{ id: string; isAdmin: boolean }>({ id: "", isAdmin: false });
  const [orgMembers, setOrgMembers] = useState<OrgMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newGoal, setNewGoal] = useState({ title: "", description: "", due_date: "" });
  const [newVisibility, setNewVisibility] = useState<"team" | "private">("team");
  const [newInvitees, setNewInvitees] = useState<string[]>([]);
  const [inviteOpenFor, setInviteOpenFor] = useState<string | null>(null);
  const inviteRef = useRef<HTMLDivElement>(null);

  function load() {
    return fetch("/api/goals").then((r) => r.json()).then(({ goals: gs, keyResults: krs, members: ms, me: m }) => {
      if (!Array.isArray(gs)) return;
      setGoals(gs.map((g: Goal) => ({ ...g, expanded: true, keyResults: (krs ?? []).filter((kr: KeyResult) => kr.goal_id === g.id) })));
      setMembers(ms ?? []);
      if (m) setMe(m);
    });
  }

  useEffect(() => {
    load().finally(() => setLoading(false));
    fetch("/api/members").then(r => r.json()).then(d => Array.isArray(d) && setOrgMembers(d)).catch(() => {});
  }, []);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (inviteRef.current && !inviteRef.current.contains(e.target as Node)) setInviteOpenFor(null);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function participantsOf(goalId: string) { return members.filter(m => m.goal_id === goalId); }

  function canUpdate(goal: Goal) {
    return me.isAdmin || goal.created_by === me.id || participantsOf(goal.id).some(m => m.user_id === me.id);
  }

  async function addGoal() {
    if (!newGoal.title.trim()) return;
    const res = await fetch("/api/goals", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "goal", id: `g${Date.now()}`, ...newGoal, visibility: newVisibility, member_ids: newInvitees }),
    });
    if (res.ok) await load();
    setNewGoal({ title: "", description: "", due_date: "" });
    setNewInvitees([]);
    setNewVisibility("team");
    setCreating(false);
    track("goal_created", { visibility: newVisibility, invited: newInvitees.length });
  }

  async function invite(goalId: string, userId: string) {
    await fetch("/api/goals/members", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goal_id: goalId, user_ids: [userId] }),
    });
    await load();
  }

  async function removeMember(goalId: string, userId: string) {
    await fetch("/api/goals/members", {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goal_id: goalId, user_id: userId }),
    });
    await load();
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

          {/* Personal vs team */}
          <div className="flex items-center gap-1 rounded-lg p-1 w-fit mb-3" style={{ background: "var(--bg-primary)", border: "1px solid var(--border)" }}>
            {([["team", "Team goal", Users], ["private", "Just me", Lock]] as const).map(([v, label, Icon]) => (
              <button key={v} onClick={() => setNewVisibility(v)}
                className="flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors"
                style={{ background: newVisibility === v ? "var(--accent-purple)" : "transparent", color: newVisibility === v ? "#fff" : "var(--text-secondary)" }}>
                <Icon size={11} /> {label}
              </button>
            ))}
          </div>

          {/* Invite participants (team goals) */}
          {newVisibility === "team" && orgMembers.filter(m => m.id !== me.id).length > 0 && (
            <div className="mb-3">
              <p className="text-xs mb-1.5" style={{ color: "var(--text-secondary)" }}>Invite participants — they can update progress too</p>
              <div className="flex flex-wrap gap-1.5">
                {orgMembers.filter(m => m.id !== me.id).map(m => {
                  const on = newInvitees.includes(m.id);
                  return (
                    <button key={m.id}
                      onClick={() => setNewInvitees(ids => on ? ids.filter(i => i !== m.id) : [...ids, m.id])}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs transition-colors"
                      style={{
                        background: on ? "rgba(124,58,237,0.15)" : "var(--bg-primary)",
                        color: on ? "var(--accent-purple)" : "var(--text-secondary)",
                        border: `1px solid ${on ? "var(--accent-purple)" : "var(--border)"}`,
                      }}>
                      {on ? "✓ " : "+ "}{m.full_name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

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
            const parts = participantsOf(goal.id);
            const editable = canUpdate(goal);
            const canInvite = (goal.created_by === me.id || me.isAdmin);
            const notInGoal = orgMembers.filter(m => m.id !== goal.created_by && !parts.some(p => p.user_id === m.id));
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
                        <div className="flex items-center gap-2 min-w-0">
                          <h3 className="font-semibold text-sm truncate" style={{ color: "var(--text-primary)" }}>{goal.title}</h3>
                          {goal.visibility === "private" && (
                            <span title="Only you can see this goal"><Lock size={11} style={{ color: "var(--text-muted)" }} /></span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {goal.due_date && <span className="text-xs" style={{ color: "var(--text-secondary)" }}>Due {new Date(goal.due_date).toLocaleDateString()}</span>}
                          <span className="text-xs font-bold" style={{ color: pct >= 100 ? "#22c55e" : "var(--accent-purple)" }}>{pct}%</span>
                          {(goal.created_by === me.id || me.isAdmin) && (
                            <button onClick={(e) => { e.stopPropagation(); deleteGoal(goal.id); }} className="p-1 rounded hover:bg-red-500/10" style={{ color: "var(--danger)" }}>
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                      {goal.description && <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>{goal.description}</p>}

                      {/* Participants */}
                      <div className="flex items-center gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center">
                          {(() => {
                            const creator = orgMembers.find(m => m.id === goal.created_by);
                            return creator ? <Avatar name={creator.full_name} title={`${creator.full_name} (creator)`} /> : null;
                          })()}
                          {parts.slice(0, 6).map(p => <Avatar key={p.user_id} name={p.full_name} />)}
                          {parts.length > 6 && <span className="text-xs ml-1" style={{ color: "var(--text-secondary)" }}>+{parts.length - 6}</span>}
                        </div>

                        {canInvite && notInGoal.length > 0 && (
                          <div className="relative" ref={inviteOpenFor === goal.id ? inviteRef : undefined}>
                            <button onClick={() => setInviteOpenFor(inviteOpenFor === goal.id ? null : goal.id)}
                              className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full transition-colors hover:bg-white/10"
                              style={{ color: "var(--text-secondary)", border: "1px dashed var(--border-strong)" }}>
                              <UserPlus size={10} /> Invite
                            </button>
                            {inviteOpenFor === goal.id && (
                              <div className="absolute left-0 top-full mt-1 w-52 rounded-xl border shadow-2xl z-30 py-1 max-h-56 overflow-y-auto"
                                style={{ background: "var(--bg-elevated)", borderColor: "var(--border-strong)" }}>
                                {notInGoal.map(m => (
                                  <button key={m.id} onClick={() => { invite(goal.id, m.id); setInviteOpenFor(null); }}
                                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors hover:bg-white/10"
                                    style={{ color: "var(--text-primary)" }}>
                                    <Avatar name={m.full_name} /> {m.full_name}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* participant can leave; creator can remove */}
                        {parts.some(p => p.user_id === me.id) && (
                          <button onClick={() => removeMember(goal.id, me.id)}
                            className="text-xs hover:underline" style={{ color: "var(--text-muted)" }}>
                            Leave
                          </button>
                        )}
                      </div>

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
                                {editable ? (
                                  <div className="flex items-center rounded-lg overflow-hidden border"
                                    style={{ borderColor: "var(--border)", background: "var(--bg-primary)" }}
                                    onClick={(e) => e.stopPropagation()}>
                                    <button
                                      onClick={() => updateKR(goal.id, kr.id, { current_value: Math.max(0, kr.current_value - 1) })}
                                      className="w-6 h-6 flex items-center justify-center text-sm font-semibold transition-colors hover:bg-white/10"
                                      style={{ color: "var(--text-secondary)" }}>
                                      −
                                    </button>
                                    <input type="number" value={kr.current_value}
                                      onChange={(e) => updateKR(goal.id, kr.id, { current_value: Number(e.target.value) })}
                                      className="w-12 text-xs text-center bg-transparent outline-none py-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                      style={{ color: "var(--text-primary)" }}
                                    />
                                    <button
                                      onClick={() => updateKR(goal.id, kr.id, { current_value: kr.current_value + 1 })}
                                      className="w-6 h-6 flex items-center justify-center text-sm font-semibold transition-colors hover:bg-white/10"
                                      style={{ color: "var(--text-secondary)" }}>
                                      +
                                    </button>
                                  </div>
                                ) : (
                                  <span className="text-xs px-2 py-1 rounded-lg flex items-center gap-1" title="Ask the goal creator to invite you to update progress"
                                    style={{ background: "var(--bg-primary)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
                                    <Lock size={9} /> {kr.current_value}
                                  </span>
                                )}
                                <span className="text-xs" style={{ color: "var(--text-secondary)" }}>/ {kr.target_value} {kr.unit}</span>
                                <span className="text-xs font-bold w-8 text-right" style={{ color: krPct >= 100 ? "#22c55e" : "var(--text-secondary)" }}>{krPct}%</span>
                              </div>
                            </div>
                            <ProgressBar value={krPct} size="sm" />
                          </div>
                        );
                      })}
                    </div>
                    {editable && (
                      <button onClick={() => addKR(goal.id)} className="flex items-center gap-1 text-xs mt-3 hover:opacity-80" style={{ color: "var(--accent-purple)" }}>
                        <Plus size={12} /> Add key result
                      </button>
                    )}
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
