"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useWorkspaceStore } from "@/store/workspace";
import { CheckCircle2, Clock, AlertCircle, TrendingUp, AlertTriangle, Loader2 } from "lucide-react";
import Link from "next/link";

interface Summary { total: number; done: number; inProgress: number; urgent: number; overdue: number; recent: any[]; }

const STATUS_COLOR: Record<string, string> = {
  todo: "#94a3b8", in_progress: "#3b82f6", in_review: "#f59e0b", done: "#22c55e",
};

export default function HomePage() {
  const router = useRouter();
  const { spaces, loaded } = useWorkspaceStore();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);

  useEffect(() => {
    if (!loaded) return;
    const done = localStorage.getItem("wb_onboarded");
    if (!done && spaces.length === 0) router.replace("/onboarding");
  }, [loaded, spaces.length]);

  useEffect(() => {
    fetch("/api/tasks/summary").then((r) => r.json()).then((d) => setSummary(d)).catch(() => {}).finally(() => setSummaryLoading(false));
  }, []);

  const completion = summary && summary.total > 0 ? Math.round((summary.done / summary.total) * 100) : 0;

  return (
    <div className="overflow-y-auto h-full p-8">
      <h1 className="text-2xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>Good day 👋</h1>
      <p className="text-sm mb-8" style={{ color: "var(--text-secondary)" }}>Here's what's happening in your workspace.</p>

      {summaryLoading ? (
        <div className="flex justify-center py-16"><Loader2 size={20} className="animate-spin" style={{ color: "var(--text-secondary)" }} /></div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
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
              <span className="text-sm" style={{ color: "var(--danger)" }}>
                {summary!.urgent} urgent task{summary!.urgent !== 1 ? "s" : ""} need your attention
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Recent tasks */}
            <div className="rounded-xl border p-4" style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
              <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Recent Tasks</h2>
              <div className="space-y-2">
                {(summary?.recent ?? []).length === 0 ? (
                  <p className="text-xs py-4 text-center" style={{ color: "var(--text-secondary)" }}>No tasks yet</p>
                ) : (summary?.recent ?? []).map((task: any) => (
                  <div key={task.id} className="flex items-center gap-3 py-1.5">
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

            {/* Spaces */}
            <div className="rounded-xl border p-4" style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
              <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Spaces</h2>
              {spaces.length === 0 ? (
                <p className="text-xs py-4 text-center" style={{ color: "var(--text-secondary)" }}>No spaces yet</p>
              ) : (
                <div className="space-y-2">
                  {spaces.map((space) => {
                    const lists = [...space.lists, ...space.folders.flatMap((f) => f.lists)];
                    return (
                      <div key={space.id} className="flex items-center gap-3 py-1.5">
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
          </div>
        </>
      )}
    </div>
  );
}
