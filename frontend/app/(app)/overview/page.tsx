"use client";
import { useEffect, useState } from "react";
import { useWorkspaceStore } from "@/store/workspace";
import { CheckSquare, Clock, AlertCircle, TrendingUp, Zap, BarChart2, Calendar, AlertTriangle, Loader2 } from "lucide-react";
import Link from "next/link";

interface Summary {
  total: number; done: number; inProgress: number; inReview: number; todo: number;
  urgent: number; overdue: number;
  recent: any[]; dueToday: any[];
  tasksByList: Record<string, [number, number]>; // [total, done]
}

function StatCard({ icon: Icon, label, value, sub, color }: { icon: any; label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div className="rounded-xl p-4 border flex items-start gap-3" style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
      <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${color}18` }}>
        <Icon size={17} style={{ color }} />
      </div>
      <div>
        <p className="text-xs mb-0.5" style={{ color: "var(--text-secondary)" }}>{label}</p>
        <p className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{value}</p>
        {sub && <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>{sub}</p>}
      </div>
    </div>
  );
}

function MiniBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max ? (value / max) * 100 : 0;
  return (
    <div className="mb-3">
      <div className="flex justify-between mb-1">
        <span className="text-xs" style={{ color: "var(--text-primary)" }}>{label}</span>
        <span className="text-xs font-medium" style={{ color }}>{value}</span>
      </div>
      <div className="h-1.5 rounded-full" style={{ background: "var(--bg-primary)" }}>
        <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

const STATUS_DOT: Record<string, string> = {
  todo: "#94a3b8", in_progress: "#3b82f6", in_review: "#f59e0b", done: "#22c55e",
};

export default function OverviewPage() {
  const { spaces } = useWorkspaceStore();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const today = new Date();

  useEffect(() => {
    fetch("/api/tasks/summary")
      .then((r) => r.json())
      .then((d) => setSummary(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const s = summary;
  const total = s?.total ?? 0;
  const completion = total > 0 ? Math.round(((s?.done ?? 0) / total) * 100) : 0;

  // Per-space progress using tasksByList from DB cross-referenced with workspace store
  const spacesWithProgress = spaces.map((space) => {
    const lists = [...space.lists, ...space.folders.flatMap((f) => f.lists)];
    let spaceTotal = 0, spaceDone = 0;
    for (const list of lists) {
      const counts = s?.tasksByList?.[list.id];
      if (counts) { spaceTotal += counts[0]; spaceDone += counts[1]; }
    }
    const pct = spaceTotal > 0 ? Math.round((spaceDone / spaceTotal) * 100) : 0;
    return { ...space, spaceTotal, spaceDone, pct, firstListId: lists[0]?.id };
  });

  return (
    <div className="p-6 overflow-y-auto h-full">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Overview</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
            {today.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 size={20} className="animate-spin" style={{ color: "var(--text-secondary)" }} /></div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
              <StatCard icon={CheckSquare} label="Total tasks" value={total} sub={`${s?.done ?? 0} completed`} color="#22c55e" />
              <StatCard icon={Clock} label="In progress" value={s?.inProgress ?? 0} sub={`${total ? Math.round(((s?.inProgress ?? 0)/total)*100) : 0}% of total`} color="#3b82f6" />
              <StatCard icon={AlertCircle} label="Urgent" value={s?.urgent ?? 0} sub={s?.overdue ? `${s.overdue} overdue` : "No overdue"} color="#ef4444" />
              <StatCard icon={TrendingUp} label="Completion" value={`${completion}%`} sub={`${s?.done ?? 0} of ${total} done`} color="#7c3aed" />
            </div>

            {/* Overdue banner */}
            {(s?.overdue ?? 0) > 0 && (
              <div className="rounded-xl p-3 mb-5 flex items-center gap-3" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)" }}>
                <AlertTriangle size={15} style={{ color: "#ef4444" }} />
                <span className="text-sm" style={{ color: "#ef4444" }}>
                  {s!.overdue} overdue task{s!.overdue !== 1 ? "s" : ""} — review them soon
                </span>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
              {/* Status breakdown */}
              <div className="rounded-xl p-4 border" style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
                <div className="flex items-center gap-2 mb-4">
                  <BarChart2 size={15} style={{ color: "var(--accent-purple)" }} />
                  <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Status breakdown</h2>
                </div>
                <MiniBar label="To do" value={s?.todo ?? 0} max={total || 1} color="#94a3b8" />
                <MiniBar label="In progress" value={s?.inProgress ?? 0} max={total || 1} color="#3b82f6" />
                <MiniBar label="In review" value={s?.inReview ?? 0} max={total || 1} color="#f59e0b" />
                <MiniBar label="Done" value={s?.done ?? 0} max={total || 1} color="#22c55e" />
              </div>

              {/* Due today */}
              <div className="rounded-xl p-4 border" style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
                <div className="flex items-center gap-2 mb-4">
                  <Calendar size={15} style={{ color: "#f59e0b" }} />
                  <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Due today</h2>
                  {(s?.dueToday?.length ?? 0) > 0 && (
                    <span className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(245,158,11,0.15)", color: "#f59e0b" }}>
                      {s!.dueToday.length}
                    </span>
                  )}
                </div>
                {!s?.dueToday?.length ? (
                  <p className="text-xs text-center py-4" style={{ color: "var(--text-secondary)" }}>Nothing due today 🎉</p>
                ) : s.dueToday.slice(0, 6).map((t: any) => (
                  <div key={t.id} className="flex items-center gap-2 py-1.5">
                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ background: t.priority === "urgent" ? "#ef4444" : t.priority === "high" ? "#f97316" : "#94a3b8" }} />
                    <span className="text-xs truncate" style={{ color: "var(--text-primary)" }}>{t.title}</span>
                  </div>
                ))}
              </div>

              {/* Spaces */}
              <div className="rounded-xl p-4 border" style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
                <div className="flex items-center gap-2 mb-4">
                  <Zap size={15} style={{ color: "#3b82f6" }} />
                  <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Spaces</h2>
                </div>
                {spacesWithProgress.length === 0 ? (
                  <p className="text-xs text-center py-4" style={{ color: "var(--text-secondary)" }}>No spaces yet</p>
                ) : spacesWithProgress.map((space) => (
                  <div key={space.id} className="mb-3">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">{space.icon}</span>
                        <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>{space.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{space.spaceDone}/{space.spaceTotal}</span>
                        <span className="text-xs font-semibold" style={{ color: space.color }}>{space.pct}%</span>
                      </div>
                    </div>
                    <div className="h-1 rounded-full" style={{ background: "var(--bg-primary)" }}>
                      <div className="h-1 rounded-full transition-all" style={{ width: `${space.pct}%`, background: space.color }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent tasks */}
            <div className="rounded-xl p-4 border" style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
              <div className="flex items-center gap-2 mb-4">
                <Zap size={15} style={{ color: "var(--accent-purple)" }} />
                <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Recent tasks</h2>
              </div>
              <div className="divide-y" style={{ borderColor: "var(--border)" }}>
                {!s?.recent?.length ? (
                  <p className="text-xs py-4 text-center" style={{ color: "var(--text-secondary)" }}>No tasks yet. Create some!</p>
                ) : s.recent.map((t: any) => (
                  <div key={t.id} className="flex items-center gap-3 py-2">
                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: STATUS_DOT[t.status] ?? "#94a3b8" }} />
                    <span className="text-sm flex-1 truncate"
                      style={{ color: "var(--text-primary)", opacity: t.status === "done" ? 0.5 : 1, textDecoration: t.status === "done" ? "line-through" : "none" }}>
                      {t.title}
                    </span>
                    <span className="text-xs capitalize px-2 py-0.5 rounded-full"
                      style={{ background: "var(--bg-primary)", color: "var(--text-secondary)" }}>
                      {t.status.replace("_", " ")}
                    </span>
                    {t.due_date && (
                      <span className="text-xs" style={{ color: t.due_date < today.toISOString().slice(0, 10) && t.status !== "done" ? "#ef4444" : "var(--text-secondary)" }}>
                        {new Date(t.due_date).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
