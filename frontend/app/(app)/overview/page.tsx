"use client";
import { useTasksStore } from "@/store/tasks";
import { useWorkspaceStore } from "@/store/workspace";
import { CheckSquare, Clock, AlertCircle, TrendingUp, Zap, BarChart2, Calendar } from "lucide-react";

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

export default function OverviewPage() {
  const { tasks } = useTasksStore();
  const { spaces } = useWorkspaceStore();

  const allTasks = Object.values(tasks).flat();
  const total = allTasks.length;
  const done = allTasks.filter((t) => t.status === "done").length;
  const inProgress = allTasks.filter((t) => t.status === "in_progress").length;
  const urgent = allTasks.filter((t) => t.priority === "urgent").length;
  const overdue = allTasks.filter((t) => t.due_date && new Date(t.due_date) < new Date() && t.status !== "done").length;
  const statusCounts = { todo: allTasks.filter((t) => t.status === "todo").length, in_progress: inProgress, in_review: allTasks.filter((t) => t.status === "in_review").length, done };
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const dueTodayTasks = allTasks.filter((t) => t.due_date === todayStr && t.status !== "done");
  const recentTasks = [...allTasks].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 5);

  return (
    <div className="p-6 overflow-y-auto h-full">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Overview</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
            {today.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <StatCard icon={CheckSquare} label="Total tasks" value={total} sub={`${done} completed`} color="#22c55e" />
          <StatCard icon={Clock} label="In progress" value={inProgress} sub={`${total ? Math.round((inProgress/total)*100) : 0}% of total`} color="#3b82f6" />
          <StatCard icon={AlertCircle} label="Urgent" value={urgent} sub={overdue ? `${overdue} overdue` : "No overdue"} color="#ef4444" />
          <StatCard icon={TrendingUp} label="Completion" value={`${total ? Math.round((done/total)*100) : 0}%`} sub={`${done} of ${total} done`} color="#7c3aed" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="rounded-xl p-4 border" style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
            <div className="flex items-center gap-2 mb-4">
              <BarChart2 size={15} style={{ color: "var(--accent-purple)" }} />
              <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Status breakdown</h2>
            </div>
            <MiniBar label="To do" value={statusCounts.todo} max={total || 1} color="#94a3b8" />
            <MiniBar label="In progress" value={statusCounts.in_progress} max={total || 1} color="#3b82f6" />
            <MiniBar label="In review" value={statusCounts.in_review} max={total || 1} color="#f59e0b" />
            <MiniBar label="Done" value={statusCounts.done} max={total || 1} color="#22c55e" />
          </div>

          <div className="rounded-xl p-4 border" style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
            <div className="flex items-center gap-2 mb-4">
              <Calendar size={15} style={{ color: "#f59e0b" }} />
              <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Due today</h2>
              {dueTodayTasks.length > 0 && (
                <span className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(245,158,11,0.15)", color: "#f59e0b" }}>
                  {dueTodayTasks.length}
                </span>
              )}
            </div>
            {dueTodayTasks.length === 0 ? (
              <p className="text-xs text-center py-4" style={{ color: "var(--text-secondary)" }}>Nothing due today</p>
            ) : (
              <div className="space-y-2">
                {dueTodayTasks.slice(0, 5).map((t) => (
                  <div key={t.id} className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ background: t.priority === "urgent" ? "#ef4444" : t.priority === "high" ? "#f97316" : "#94a3b8" }} />
                    <span className="text-xs truncate" style={{ color: "var(--text-primary)" }}>{t.title}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl p-4 border" style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
            <div className="flex items-center gap-2 mb-4">
              <Zap size={15} style={{ color: "#3b82f6" }} />
              <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Spaces</h2>
            </div>
            {spaces.length === 0 ? (
              <p className="text-xs text-center py-4" style={{ color: "var(--text-secondary)" }}>No spaces yet</p>
            ) : (
              <div className="space-y-3">
                {spaces.map((space) => {
                  const listsInSpace = space.folders.flatMap((f) => f.lists).concat(space.lists);
                  const tasksInSpace = listsInSpace.flatMap((l) => tasks[l.id] || []);
                  const doneInSpace = tasksInSpace.filter((t) => t.status === "done").length;
                  const pct = tasksInSpace.length ? Math.round((doneInSpace / tasksInSpace.length) * 100) : 0;
                  return (
                    <div key={space.id}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          <span>{space.icon}</span>
                          <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>{space.name}</span>
                        </div>
                        <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{pct}%</span>
                      </div>
                      <div className="h-1 rounded-full" style={{ background: "var(--bg-primary)" }}>
                        <div className="h-1 rounded-full" style={{ width: `${pct}%`, background: space.color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 rounded-xl p-4 border" style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
          <div className="flex items-center gap-2 mb-4">
            <Zap size={15} style={{ color: "var(--accent-purple)" }} />
            <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Recent tasks</h2>
          </div>
          <div className="divide-y" style={{ borderColor: "var(--border)" }}>
            {recentTasks.length === 0 ? (
              <p className="text-xs py-4 text-center" style={{ color: "var(--text-secondary)" }}>No tasks yet. Create some!</p>
            ) : recentTasks.map((t) => (
              <div key={t.id} className="flex items-center gap-3 py-2">
                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ background: t.status === "done" ? "#22c55e" : t.status === "in_progress" ? "#3b82f6" : "#94a3b8" }} />
                <span className="text-sm flex-1 truncate" style={{ color: "var(--text-primary)", opacity: t.status === "done" ? 0.5 : 1, textDecoration: t.status === "done" ? "line-through" : "none" }}>
                  {t.title}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full capitalize"
                  style={{ background: "var(--bg-primary)", color: "var(--text-secondary)" }}>
                  {t.status.replace("_", " ")}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
