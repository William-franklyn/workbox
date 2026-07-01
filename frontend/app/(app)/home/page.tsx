"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useWorkspaceStore } from "@/store/workspace";
import { CheckCircle2, Clock, AlertCircle, TrendingUp, AlertTriangle, Loader2, Target, Zap, Activity, ArrowRight, Layout } from "lucide-react";
import Link from "next/link";

interface Summary { total: number; done: number; inProgress: number; urgent: number; overdue: number; recent: any[]; }
interface Goal { id: string; title: string; due_date: string; key_results: { current_value: number; target_value: number }[]; }
interface ActivityEntry { id: string; user_name: string; action: string; entity_name: string; entity_type: string; created_at: string; }

const STATUS_COLOR: Record<string, string> = {
  todo: "#94a3b8", in_progress: "#7c3aed", in_review: "#f59e0b", done: "#22c55e",
};

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function GoalProgress({ goal }: { goal: Goal }) {
  const total = goal.key_results.reduce((s, kr) => s + kr.target_value, 0);
  const current = goal.key_results.reduce((s, kr) => s + Math.min(kr.current_value, kr.target_value), 0);
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  const color = pct >= 70 ? "var(--success)" : pct >= 30 ? "var(--warning)" : "var(--danger)";
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate mb-1" style={{ color: "var(--text-primary)" }}>{goal.title}</p>
        <div className="h-1.5 rounded-full" style={{ background: "var(--border)" }}>
          <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
        </div>
      </div>
      <span className="text-xs font-bold flex-shrink-0" style={{ color }}>{pct}%</span>
    </div>
  );
}

export default function HomePage() {
  const router = useRouter();
  const { spaces, loaded } = useWorkspaceStore();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!loaded) return;
    const done = localStorage.getItem("wb_onboarded");
    if (!done && spaces.length === 0) router.replace("/onboarding");
  }, [loaded, spaces.length]);

  useEffect(() => {
    Promise.all([
      fetch("/api/tasks/summary").then((r) => r.json()).catch(() => null),
      fetch("/api/goals").then((r) => r.json()).catch(() => ({ goals: [] })),
      fetch("/api/activity-log?limit=6").then((r) => r.json()).catch(() => ({ logs: [] })),
    ]).then(([s, g, a]) => {
      if (s) setSummary(s);
      setGoals((g.goals ?? []).slice(0, 4));
      setActivity(a.logs ?? []);
    }).finally(() => setLoading(false));
  }, []);

  const completion = summary && summary.total > 0 ? Math.round((summary.done / summary.total) * 100) : 0;
  const activeGoals = goals.filter((g) => !g.due_date || new Date(g.due_date) >= new Date());

  return (
    <div className="overflow-y-auto h-full p-8">
      <h1 className="text-2xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>Good day 👋</h1>
      <p className="text-sm mb-8" style={{ color: "var(--text-secondary)" }}>Here's what's happening in your workspace.</p>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={20} className="animate-spin" style={{ color: "var(--text-secondary)" }} /></div>
      ) : (
        <>
          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            {[
              { label: "Total Tasks", value: summary?.total ?? 0, icon: <TrendingUp size={18} />, color: "var(--accent-blue)" },
              { label: "In Progress", value: summary?.inProgress ?? 0, icon: <Clock size={18} />, color: "var(--accent-purple)" },
              { label: "Completed", value: summary?.done ?? 0, icon: <CheckCircle2 size={18} />, color: "var(--success)" },
              { label: "Overdue", value: summary?.overdue ?? 0, icon: <AlertTriangle size={18} />, color: "var(--danger)" },
            ].map(({ label, value, icon, color }) => (
              <div key={label} className="rounded-xl p-4 border" style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>{label}</span>
                  <span style={{ color }}>{icon}</span>
                </div>
                <p className="text-3xl font-bold" style={{ color: "var(--text-primary)" }}>{value}</p>
                {label === "Completed" && (summary?.total ?? 0) > 0 && (
                  <div className="mt-2">
                    <div className="h-1 rounded-full" style={{ background: "var(--border)" }}>
                      <div className="h-1 rounded-full transition-all" style={{ width: `${completion}%`, background: "var(--success)" }} />
                    </div>
                    <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>{completion}% completion</p>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Urgent banner */}
          {(summary?.urgent ?? 0) > 0 && (
            <div className="rounded-xl p-3 mb-6 flex items-center gap-3" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)" }}>
              <AlertCircle size={16} style={{ color: "var(--danger)" }} />
              <span className="text-sm flex-1" style={{ color: "var(--danger)" }}>
                {summary!.urgent} urgent task{summary!.urgent !== 1 ? "s" : ""} need your attention
              </span>
            </div>
          )}

          {/* Main grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Recent tasks */}
            <div className="rounded-xl border p-4" style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
              <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Recent Tasks</h2>
              <div className="space-y-0.5">
                {(summary?.recent ?? []).length === 0 ? (
                  <p className="text-xs py-4 text-center" style={{ color: "var(--text-secondary)" }}>No tasks yet</p>
                ) : (summary?.recent ?? []).map((task: any) => (
                  <div key={task.id} className="flex items-center gap-3 py-1.5 rounded-lg px-2 hover:bg-white/5 transition-colors">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: STATUS_COLOR[task.status] ?? "#94a3b8" }} />
                    <span className="text-sm flex-1 truncate"
                      style={{ color: "var(--text-primary)", opacity: task.status === "done" ? 0.5 : 1, textDecoration: task.status === "done" ? "line-through" : "none" }}>
                      {task.title}
                    </span>
                    {task.due_date && (
                      <span className="text-xs shrink-0" style={{ color: task.due_date < new Date().toISOString().slice(0, 10) && task.status !== "done" ? "var(--danger)" : "var(--text-secondary)" }}>
                        {new Date(task.due_date).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Goals progress */}
            <div className="rounded-xl border p-4" style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
                  <Target size={14} style={{ color: "var(--accent-purple)" }} /> Goals
                </h2>
                <Link href="/goals" className="text-xs hover:underline flex items-center gap-1" style={{ color: "var(--text-secondary)" }}>
                  View all <ArrowRight size={11} />
                </Link>
              </div>
              {activeGoals.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-xs mb-2" style={{ color: "var(--text-secondary)" }}>No active goals</p>
                  <Link href="/goals" className="text-xs" style={{ color: "var(--accent-purple)" }}>Set your first goal →</Link>
                </div>
              ) : (
                <div className="divide-y" style={{ borderColor: "var(--border)" }}>
                  {activeGoals.map((g) => <GoalProgress key={g.id} goal={g} />)}
                </div>
              )}
            </div>
          </div>

          {/* Second row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Spaces */}
            <div className="rounded-xl border p-4" style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Spaces</h2>
                <Link href="/portfolio" className="text-xs hover:underline flex items-center gap-1" style={{ color: "var(--text-secondary)" }}>
                  Portfolio <ArrowRight size={11} />
                </Link>
              </div>
              {spaces.length === 0 ? (
                <p className="text-xs py-4 text-center" style={{ color: "var(--text-secondary)" }}>No spaces yet</p>
              ) : (
                <div className="space-y-1">
                  {spaces.map((space) => {
                    const lists = [...space.lists, ...space.folders.flatMap((f) => f.lists)];
                    return (
                      <div key={space.id} className="flex items-center gap-3 py-1.5 rounded-lg px-2 hover:bg-white/5 transition-colors">
                        <span className="text-lg">{space.icon}</span>
                        <span className="text-sm font-medium flex-1" style={{ color: "var(--text-primary)" }}>{space.name}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: `${space.color}22`, color: space.color }}>
                          {lists.length} list{lists.length !== 1 ? "s" : ""}
                        </span>
                        {lists[0] && (
                          <Link href={`/tasks/${lists[0].id}`} className="text-xs hover:underline" style={{ color: "var(--text-secondary)" }}>Open →</Link>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Recent activity */}
            <div className="rounded-xl border p-4" style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
                  <Activity size={14} style={{ color: "var(--accent-purple)" }} /> Recent Activity
                </h2>
                <Link href="/activity" className="text-xs hover:underline flex items-center gap-1" style={{ color: "var(--text-secondary)" }}>
                  View all <ArrowRight size={11} />
                </Link>
              </div>
              {activity.length === 0 ? (
                <p className="text-xs py-4 text-center" style={{ color: "var(--text-secondary)" }}>No recent activity</p>
              ) : (
                <div className="space-y-3">
                  {activity.map((entry) => (
                    <div key={entry.id} className="flex items-start gap-2.5">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5"
                        style={{ background: "var(--accent-purple)", color: "white" }}>
                        {(entry.user_name ?? "?")[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                          <span className="font-medium" style={{ color: "var(--text-primary)" }}>{entry.user_name}</span>
                          {" "}{entry.action}{" "}
                          <span style={{ color: "var(--accent-purple)" }}>{entry.entity_name}</span>
                        </p>
                      </div>
                      <span className="text-xs flex-shrink-0" style={{ color: "var(--text-secondary)" }}>{timeAgo(entry.created_at)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Quick actions strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Templates", desc: "Start a new project fast", icon: <Layout size={16} />, href: "/templates", color: "#7c3aed" },
              { label: "Automations", desc: "Set up workflow rules", icon: <Zap size={16} />, href: "/automations", color: "#f59e0b" },
              { label: "Workload", desc: "See team capacity", icon: <TrendingUp size={16} />, href: "/workload", color: "#3b82f6" },
              { label: "Portfolio", desc: "Executive overview", icon: <Target size={16} />, href: "/portfolio", color: "#22c55e" },
            ].map(({ label, desc, icon, href, color }) => (
              <Link key={label} href={href}
                className="rounded-xl border p-3.5 flex items-center gap-3 transition-colors hover:bg-white/5"
                style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${color}22`, color }}>
                  {icon}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{label}</p>
                  <p className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>{desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
