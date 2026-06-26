"use client";
import { useTasksStore } from "@/store/tasks";
import { useWorkspaceStore } from "@/store/workspace";
import { CheckCircle2, Clock, AlertCircle, TrendingUp } from "lucide-react";
import Link from "next/link";

export default function HomePage() {
  const { tasks } = useTasksStore();
  const { spaces } = useWorkspaceStore();
  const allTasks = Object.values(tasks).flat();

  const stats = {
    total: allTasks.length,
    done: allTasks.filter((t) => t.status === "done").length,
    inProgress: allTasks.filter((t) => t.status === "in_progress").length,
    urgent: allTasks.filter((t) => t.priority === "urgent").length,
  };
  const completion = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;

  const recent = allTasks.slice(-5).reverse();

  return (
    <div className="overflow-y-auto h-full p-8">
      <h1 className="text-2xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>Good day 👋</h1>
      <p className="text-sm mb-8" style={{ color: "var(--text-secondary)" }}>Here's what's happening in your workspace.</p>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: "Total Tasks", value: stats.total, icon: <TrendingUp size={18} />, color: "var(--accent-blue)" },
          { label: "In Progress", value: stats.inProgress, icon: <Clock size={18} />, color: "var(--accent-purple)" },
          { label: "Completed", value: stats.done, icon: <CheckCircle2 size={18} />, color: "var(--success)" },
          { label: "Urgent", value: stats.urgent, icon: <AlertCircle size={18} />, color: "var(--danger)" },
        ].map(({ label, value, icon, color }) => (
          <div key={label} className="rounded-xl p-4 border" style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>{label}</span>
              <span style={{ color }}>{icon}</span>
            </div>
            <p className="text-3xl font-bold" style={{ color: "var(--text-primary)" }}>{value}</p>
            {label === "Completed" && stats.total > 0 && (
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

      <div className="grid grid-cols-2 gap-6">
        {/* Recent tasks */}
        <div className="rounded-xl border p-4" style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
          <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Recent Tasks</h2>
          <div className="space-y-2">
            {recent.map((task) => (
              <div key={task.id} className="flex items-center gap-3 py-1.5">
                <span className={`w-2 h-2 rounded-full shrink-0`} style={{ background: task.status === "done" ? "var(--success)" : task.status === "in_progress" ? "var(--accent-blue)" : "var(--text-secondary)" }} />
                <span className="text-sm flex-1 truncate" style={{ color: "var(--text-primary)", opacity: task.status === "done" ? 0.5 : 1, textDecoration: task.status === "done" ? "line-through" : "none" }}>
                  {task.title}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Spaces */}
        <div className="rounded-xl border p-4" style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
          <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Spaces</h2>
          <div className="space-y-2">
            {spaces.map((space) => (
              <div key={space.id} className="flex items-center gap-3 py-1.5">
                <span className="text-lg">{space.icon}</span>
                <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{space.name}</span>
                <span className="ml-auto text-xs px-2 py-0.5 rounded-full" style={{ background: `${space.color}22`, color: space.color }}>
                  {space.lists.length + space.folders.reduce((a, f) => a + f.lists.length, 0)} lists
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
