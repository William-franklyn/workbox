"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useWorkspaceStore } from "@/store/workspace";
import { CheckCircle2, Clock, AlertCircle, TrendingUp, AlertTriangle, Loader2, Target, Zap, Activity, ArrowRight, Layout, Sparkles, RefreshCw, Circle, X } from "lucide-react";
import Link from "next/link";

/** First-run checklist shown while the workspace has no tasks yet. */
function GettingStarted({ personalListId, onDismiss }: { personalListId: string | null; onDismiss: () => void }) {
  const steps = [
    { label: "Create your first task", desc: "Open your task list and add what you're working on", href: personalListId ? `/tasks/${personalListId}` : "/home" },
    { label: "Connect WhatsApp", desc: "Run WorkBox by chat or voice — verify your number", href: "/settings?tab=profile" },
    { label: "Invite a teammate", desc: "WorkBox is better together — add your team", href: "/settings?tab=members" },
    { label: "Connect your calendar", desc: "Sync Google or Outlook meetings into tasks", href: "/integrations" },
    { label: "Write your first doc", desc: "Meeting notes, specs, or a project brief", href: "/docs" },
  ];
  return (
    <div className="rounded-xl border mb-6 p-5" style={{ background: "var(--bg-secondary)", borderColor: "var(--accent-purple)" }}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>🚀 Get started with WorkBox</h2>
        <button onClick={onDismiss} className="p-1 rounded hover:bg-white/10" style={{ color: "var(--text-secondary)" }}>
          <X size={14} />
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {steps.map((s) => (
          <Link key={s.label} href={s.href}
            className="flex items-start gap-3 p-3 rounded-lg border transition-colors hover:bg-white/5 group"
            style={{ borderColor: "var(--border)" }}>
            <Circle size={15} className="mt-0.5 shrink-0" style={{ color: "var(--accent-purple)" }} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{s.label}</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>{s.desc}</p>
            </div>
            <ArrowRight size={13} className="mt-1 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "var(--text-secondary)" }} />
          </Link>
        ))}
      </div>
    </div>
  );
}

interface Summary { total: number; done: number; inProgress: number; urgent: number; overdue: number; recent: any[]; }
interface Goal { id: string; title: string; due_date: string; key_results: { current_value: number; target_value: number }[]; }
interface ActivityEntry { id: string; user_name: string; action: string; entity_name: string; entity_type: string; created_at: string; }

const STATUS_COLOR: Record<string, string> = {
  todo: "#71717a", in_progress: "#60a5fa", in_review: "#fbbf24", done: "#4ade80",
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
  const { spaces, loaded, personalListId } = useWorkspaceStore();
  const [gettingStartedDismissed, setGettingStartedDismissed] = useState(() =>
    typeof window !== "undefined" && localStorage.getItem("wb_getting_started_dismissed") === "1"
  );
  const [summary, setSummary] = useState<Summary | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [brief, setBrief] = useState<string | null>(null);
  const [briefStats, setBriefStats] = useState<Record<string, number>>({});
  const [briefLoading, setBriefLoading] = useState(true);

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
      // /api/goals returns key results separately — attach them per goal,
      // otherwise GoalProgress crashes on goal.key_results.reduce
      const krs = (g.keyResults ?? []) as { goal_id: string; current_value: number; target_value: number }[];
      setGoals(((g.goals ?? []) as Goal[]).slice(0, 4).map((goal) => ({
        ...goal,
        key_results: krs.filter((k) => k.goal_id === goal.id),
      })));
      setActivity(a.logs ?? []);
    }).finally(() => setLoading(false));
  }, []);

  function fetchBrief() {
    setBriefLoading(true);
    fetch("/api/ai/brief")
      .then((r) => r.json())
      .then((d) => {
        setBrief(d.brief ?? null);
        setBriefStats(d.stats ?? {});
      })
      .catch(() => setBrief("Have a productive day — your workspace is ready."))
      .finally(() => setBriefLoading(false));
  }

  useEffect(() => { fetchBrief(); }, []);

  const completion = summary && summary.total > 0 ? Math.round((summary.done / summary.total) * 100) : 0;
  const activeGoals = goals.filter((g) => !g.due_date || new Date(g.due_date) >= new Date());

  return (
    <div className="overflow-y-auto h-full p-8">
      <h1 className="text-2xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>Good day 👋</h1>
      <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>Here's what's happening in your workspace.</p>

      {/* AI Briefing Card */}
      <div className="rounded-xl border mb-6 overflow-hidden" style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
        <div className="flex items-start gap-4 p-5">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
            style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-primary)" }}
          >
            <Sparkles size={17} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>AI Briefing</span>
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                </span>
              </div>
              <button
                onClick={fetchBrief}
                disabled={briefLoading}
                className="p-1 rounded-lg transition-colors hover:bg-white/5 disabled:opacity-40"
                style={{ color: "var(--text-secondary)" }}
              >
                <RefreshCw size={12} className={briefLoading ? "animate-spin" : ""} />
              </button>
            </div>

            {briefLoading ? (
              <div className="space-y-2 mb-3">
                <div className="h-3 rounded-full animate-pulse" style={{ background: "var(--border)", width: "82%" }} />
                <div className="h-3 rounded-full animate-pulse" style={{ background: "var(--border)", width: "55%" }} />
              </div>
            ) : (
              <p className="text-sm leading-relaxed mb-3" style={{ color: "var(--text-primary)" }}>{brief}</p>
            )}

            {!briefLoading && Object.keys(briefStats).length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {(briefStats.overdue ?? 0) > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(239,68,68,0.12)", color: "var(--danger)" }}>
                    {briefStats.overdue} overdue
                  </span>
                )}
                {(briefStats.dueToday ?? 0) > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(245,158,11,0.12)", color: "var(--warning)" }}>
                    {briefStats.dueToday} due today
                  </span>
                )}
                {(briefStats.urgent ?? 0) > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(239,68,68,0.12)", color: "#f87171" }}>
                    {briefStats.urgent} urgent
                  </span>
                )}
                {(briefStats.inProgress ?? 0) > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.08)", color: "var(--text-primary)" }}>
                    {briefStats.inProgress} in progress
                  </span>
                )}
                {(briefStats.meetings ?? 0) > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(59,130,246,0.12)", color: "var(--accent-blue)" }}>
                    {briefStats.meetings} meeting{briefStats.meetings !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* First-run checklist: only when the workspace is empty */}
      {!loading && summary?.total === 0 && !gettingStartedDismissed && (
        <GettingStarted
          personalListId={personalListId}
          onDismiss={() => {
            setGettingStartedDismissed(true);
            localStorage.setItem("wb_getting_started_dismissed", "1");
          }}
        />
      )}

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
              { label: "Templates", desc: "Start a new project fast", icon: <Layout size={16} />, href: "/templates", color: "#a78bfa" },
              { label: "Automations", desc: "Set up workflow rules", icon: <Zap size={16} />, href: "/automations", color: "#fbbf24" },
              { label: "Workload", desc: "See team capacity", icon: <TrendingUp size={16} />, href: "/workload", color: "#60a5fa" },
              { label: "Portfolio", desc: "Executive overview", icon: <Target size={16} />, href: "/portfolio", color: "#4ade80" },
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
