"use client";
import { useEffect, useState } from "react";
import {
  Users,
  AlertCircle,
  Clock,
  ChevronDown,
  ChevronRight,
  Loader2,
  BarChart3,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────

interface TaskItem {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_date: string | null;
  list_id: string;
}

interface MemberTasks {
  total: number;
  todo: number;
  in_progress: number;
  in_review: number;
  done: number;
  overdue: number;
  urgent: number;
}

interface Member {
  id: string;
  name: string;
  email: string;
  tasks: MemberTasks;
  task_list: TaskItem[];
}

interface WorkloadData {
  members: Member[];
  unassigned_count: number;
}

// ── Constants ─────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  todo: "#64748b",
  in_progress: "#7c3aed",
  in_review: "#f59e0b",
  done: "#22c55e",
};

const STATUS_LABELS: Record<string, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  in_review: "In Review",
  done: "Done",
};

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "#ef4444",
  high: "#f97316",
  normal: "#64748b",
  low: "#94a3b8",
};

// ── Sub-components ────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  color: string;
}) {
  return (
    <div
      className="rounded-xl p-4 border flex items-start gap-3"
      style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}
    >
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: `${color}1a` }}
      >
        <Icon size={17} style={{ color }} />
      </div>
      <div>
        <p className="text-xs mb-0.5" style={{ color: "var(--text-secondary)" }}>
          {label}
        </p>
        <p className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
          {value}
        </p>
      </div>
    </div>
  );
}

function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  // Deterministic color from name
  const colors = [
    "#7c3aed",
    "#2563eb",
    "#059669",
    "#d97706",
    "#dc2626",
    "#7c3aed",
    "#0891b2",
    "#9333ea",
  ];
  const colorIndex =
    name.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) % colors.length;
  const bg = colors[colorIndex];

  return (
    <div
      className="rounded-full flex items-center justify-center font-bold text-white flex-shrink-0"
      style={{ width: size, height: size, background: bg, fontSize: size * 0.36 }}
    >
      {initials || "?"}
    </div>
  );
}

function StackedBar({ tasks }: { tasks: MemberTasks }) {
  const { total, todo, in_progress, in_review, done } = tasks;
  if (total === 0) {
    return (
      <div
        className="h-2.5 w-full rounded-full"
        style={{ background: "var(--bg-primary)" }}
      />
    );
  }

  const pct = (n: number) => `${(n / total) * 100}%`;

  return (
    <div className="h-2.5 w-full rounded-full overflow-hidden flex">
      {todo > 0 && (
        <div style={{ width: pct(todo), background: STATUS_COLORS.todo }} title={`Todo: ${todo}`} />
      )}
      {in_progress > 0 && (
        <div
          style={{ width: pct(in_progress), background: STATUS_COLORS.in_progress }}
          title={`In Progress: ${in_progress}`}
        />
      )}
      {in_review > 0 && (
        <div
          style={{ width: pct(in_review), background: STATUS_COLORS.in_review }}
          title={`In Review: ${in_review}`}
        />
      )}
      {done > 0 && (
        <div
          style={{ width: pct(done), background: STATUS_COLORS.done }}
          title={`Done: ${done}`}
        />
      )}
    </div>
  );
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: `${color}1a`, color }}
    >
      {label}
    </span>
  );
}

function SkeletonCard() {
  return (
    <div
      className="rounded-xl p-4 border animate-pulse"
      style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-full" style={{ background: "var(--bg-primary)" }} />
        <div className="flex-1 space-y-2">
          <div className="h-3 rounded w-32" style={{ background: "var(--bg-primary)" }} />
          <div className="h-2.5 rounded w-48" style={{ background: "var(--bg-primary)" }} />
        </div>
      </div>
      <div className="h-2.5 rounded-full w-full mb-3" style={{ background: "var(--bg-primary)" }} />
      <div className="flex gap-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-5 w-14 rounded-full" style={{ background: "var(--bg-primary)" }} />
        ))}
      </div>
    </div>
  );
}

function MemberCard({ member }: { member: Member }) {
  const [expanded, setExpanded] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  const { tasks } = member;
  const activeTasks = tasks.total - tasks.done;

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}
    >
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start gap-3 mb-3">
          <Avatar name={member.name} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3
                className="text-sm font-semibold truncate"
                style={{ color: "var(--text-primary)" }}
              >
                {member.name}
              </h3>
              {tasks.overdue > 0 && (
                <Badge label={`${tasks.overdue} overdue`} color="#ef4444" />
              )}
              {tasks.urgent > 0 && (
                <Badge label={`${tasks.urgent} urgent`} color="#f97316" />
              )}
            </div>
            {member.email && (
              <p className="text-xs truncate mt-0.5" style={{ color: "var(--text-secondary)" }}>
                {member.email}
              </p>
            )}
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
              {tasks.total}
            </p>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              tasks
            </p>
          </div>
        </div>

        {/* Stacked bar */}
        <StackedBar tasks={tasks} />

        {/* Legend / badges */}
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          {(["todo", "in_progress", "in_review", "done"] as const).map((s) => {
            const count = tasks[s];
            if (count === 0) return null;
            return (
              <div key={s} className="flex items-center gap-1">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ background: STATUS_COLORS[s] }}
                />
                <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                  {STATUS_LABELS[s]}: <span style={{ color: "var(--text-primary)" }}>{count}</span>
                </span>
              </div>
            );
          })}
          {activeTasks > 0 && (
            <span className="ml-auto text-xs" style={{ color: "var(--text-secondary)" }}>
              {activeTasks} active
            </span>
          )}
        </div>
      </div>

      {/* Expand toggle */}
      {member.task_list.length > 0 && (
        <>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="w-full flex items-center gap-2 px-4 py-2 text-xs font-medium transition-opacity hover:opacity-80 border-t"
            style={{
              color: "var(--text-secondary)",
              borderColor: "var(--border)",
              background: "transparent",
            }}
          >
            {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            {expanded ? "Hide" : "Show"} {member.task_list.length} task
            {member.task_list.length !== 1 ? "s" : ""}
          </button>

          {expanded && (
            <div className="border-t divide-y" style={{ borderColor: "var(--border)" }}>
              {member.task_list.map((task) => {
                const isOverdue =
                  task.due_date && task.due_date < today && task.status !== "done";
                return (
                  <div
                    key={task.id}
                    className="flex items-center gap-3 px-4 py-2.5"
                    style={{ borderColor: "var(--border)" }}
                  >
                    {/* Status dot */}
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: STATUS_COLORS[task.status] ?? "#64748b" }}
                    />
                    {/* Title */}
                    <span
                      className="text-xs flex-1 truncate"
                      style={{
                        color: "var(--text-primary)",
                        textDecoration: task.status === "done" ? "line-through" : "none",
                        opacity: task.status === "done" ? 0.5 : 1,
                      }}
                    >
                      {task.title}
                    </span>
                    {/* Priority */}
                    {task.priority && task.priority !== "normal" && (
                      <span
                        className="text-xs capitalize flex-shrink-0"
                        style={{ color: PRIORITY_COLORS[task.priority] ?? "#94a3b8" }}
                      >
                        {task.priority}
                      </span>
                    )}
                    {/* Due date */}
                    {task.due_date && (
                      <span
                        className="text-xs flex-shrink-0"
                        style={{ color: isOverdue ? "#ef4444" : "var(--text-secondary)" }}
                      >
                        {new Date(task.due_date).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function WorkloadPage() {
  const [data, setData] = useState<WorkloadData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/workload")
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const members = data?.members ?? [];
  const unassigned = data?.unassigned_count ?? 0;

  const totalActive = members.reduce((s, m) => s + m.tasks.total - m.tasks.done, 0);
  const totalOverdue = members.reduce((s, m) => s + m.tasks.overdue, 0);
  const totalUrgent = members.reduce((s, m) => s + m.tasks.urgent, 0);

  return (
    <div className="p-6 overflow-y-auto h-full">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
            Workload
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
            Team capacity at a glance
          </p>
        </div>

        {loading ? (
          <>
            {/* Skeleton stat cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="rounded-xl p-4 border animate-pulse"
                  style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="w-9 h-9 rounded-lg"
                      style={{ background: "var(--bg-primary)" }}
                    />
                    <div className="space-y-2 flex-1">
                      <div className="h-2.5 rounded w-20" style={{ background: "var(--bg-primary)" }} />
                      <div className="h-5 rounded w-10" style={{ background: "var(--bg-primary)" }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          </>
        ) : (
          <>
            {/* Summary stat bar */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
              <StatCard icon={Users} label="Team members" value={members.length} color="#7c3aed" />
              <StatCard icon={BarChart3} label="Active tasks" value={totalActive} color="#3b82f6" />
              <StatCard icon={Clock} label="Overdue" value={totalOverdue} color="#ef4444" />
              <StatCard icon={AlertCircle} label="Urgent" value={totalUrgent} color="#f97316" />
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 mb-4 flex-wrap">
              {Object.entries(STATUS_COLORS).map(([status, color]) => (
                <div key={status} className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} />
                  <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                    {STATUS_LABELS[status]}
                  </span>
                </div>
              ))}
            </div>

            {/* Member cards */}
            {members.length === 0 ? (
              <div
                className="rounded-xl border text-center py-16"
                style={{ borderColor: "var(--border)" }}
              >
                <Users
                  size={32}
                  className="mx-auto mb-3 opacity-20"
                  style={{ color: "var(--text-secondary)" }}
                />
                <p className="text-sm font-medium mb-1" style={{ color: "var(--text-primary)" }}>
                  No assigned tasks yet
                </p>
                <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                  Assign tasks to team members to see workload distribution
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {members.map((member) => (
                  <MemberCard key={member.id} member={member} />
                ))}
              </div>
            )}

            {/* Unassigned section */}
            {unassigned > 0 && (
              <div
                className="mt-4 rounded-xl border p-4 flex items-center gap-3"
                style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}
              >
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: "rgba(148,163,184,0.12)" }}
                >
                  <Users size={17} style={{ color: "var(--text-secondary)" }} />
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                    Unassigned
                  </p>
                  <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                    {unassigned} task{unassigned !== 1 ? "s" : ""} with no assignee
                  </p>
                </div>
                <span
                  className="ml-auto text-lg font-bold"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {unassigned}
                </span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
