"use client";
import { useEffect, useState } from "react";
import {
  Target,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Loader2,
  BarChart3,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────

interface TaskCounts {
  total: number;
  todo: number;
  in_progress: number;
  in_review: number;
  done: number;
  overdue: number;
}

interface ListEntry {
  id: string;
  name: string;
  task_counts: TaskCounts;
}

interface SpaceEntry {
  id: string;
  name: string;
  icon: string;
  color: string;
  task_counts: TaskCounts;
  completion_rate: number;
  lists: ListEntry[];
}

interface KeyResult {
  id: string;
  title: string;
  current_value: number;
  target_value: number;
  unit: string;
  progress: number;
}

interface GoalEntry {
  id: string;
  title: string;
  due_date: string | null;
  progress: number;
  key_results: KeyResult[];
}

interface Totals {
  spaces: number;
  total_tasks: number;
  done_tasks: number;
  overdue_tasks: number;
  completion_rate: number;
}

interface PortfolioData {
  spaces: SpaceEntry[];
  goals: GoalEntry[];
  totals: Totals;
}

// ── Progress ring ─────────────────────────────────────────────────────────

function ProgressRing({ percent }: { percent: number }) {
  const r = 28;
  const circ = 2 * Math.PI * r;
  const color =
    percent >= 70 ? "#22c55e" : percent >= 30 ? "#f59e0b" : "#ef4444";
  return (
    <svg width="72" height="72" viewBox="0 0 72 72">
      <circle cx="36" cy="36" r={r} fill="none" stroke="#334155" strokeWidth="6" />
      <circle
        cx="36"
        cy="36"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="6"
        strokeDasharray={circ}
        strokeDashoffset={circ * (1 - percent / 100)}
        strokeLinecap="round"
        transform="rotate(-90 36 36)"
      />
      <text x="36" y="40" textAnchor="middle" fontSize="13" fontWeight="bold" fill={color}>
        {percent}%
      </text>
    </svg>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────

function StatTile({
  icon: Icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  sub?: string;
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
        {sub && (
          <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
            {sub}
          </p>
        )}
      </div>
    </div>
  );
}

function ProgressBar({ value, color }: { value: number; color: string }) {
  return (
    <div
      className="h-1.5 w-full rounded-full overflow-hidden"
      style={{ background: "var(--bg-primary)" }}
    >
      <div
        className="h-1.5 rounded-full transition-all"
        style={{ width: `${Math.min(value, 100)}%`, background: color }}
      />
    </div>
  );
}

function progressColor(pct: number) {
  if (pct >= 70) return "#22c55e";
  if (pct >= 30) return "#f59e0b";
  return "#ef4444";
}

function SpaceCard({ space }: { space: SpaceEntry }) {
  const [expanded, setExpanded] = useState(false);
  const { task_counts: tc, completion_rate } = space;
  const color = progressColor(completion_rate);

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}
    >
      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start gap-3 mb-3">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 text-lg"
            style={{ background: `${space.color}20` }}
          >
            {space.icon || "📁"}
          </div>
          <div className="flex-1 min-w-0">
            <h3
              className="text-sm font-semibold truncate"
              style={{ color: "var(--text-primary)" }}
            >
              {space.name}
            </h3>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
              {tc.total} tasks &middot; {tc.done} done
              {tc.overdue > 0 && (
                <span style={{ color: "#ef4444" }}> &middot; {tc.overdue} overdue</span>
              )}
            </p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-lg font-bold" style={{ color }}>
              {completion_rate}%
            </p>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              complete
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <ProgressBar value={completion_rate} color={color} />

        {/* Status breakdown */}
        <div className="flex items-center gap-3 mt-3 flex-wrap">
          {(
            [
              ["todo", "#64748b", "To Do"],
              ["in_progress", "#7c3aed", "In Prog"],
              ["in_review", "#f59e0b", "Review"],
              ["done", "#22c55e", "Done"],
            ] as const
          ).map(([key, clr, lbl]) => {
            const count = tc[key as keyof TaskCounts] as number;
            if (count === 0) return null;
            return (
              <div key={key} className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full" style={{ background: clr }} />
                <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                  {lbl}:{" "}
                  <span style={{ color: "var(--text-primary)" }}>{count}</span>
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Lists section */}
      {space.lists.length > 0 && (
        <>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="w-full flex items-center gap-2 px-4 py-2 text-xs font-medium transition-colors hover:bg-white/10 border-t"
            style={{
              color: "var(--text-secondary)",
              borderColor: "var(--border)",
              background: "transparent",
            }}
          >
            {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            {space.lists.length} list{space.lists.length !== 1 ? "s" : ""}
          </button>

          {expanded && (
            <div className="border-t divide-y" style={{ borderColor: "var(--border)" }}>
              {space.lists.map((list) => {
                const lPct =
                  list.task_counts.total > 0
                    ? Math.round((list.task_counts.done / list.task_counts.total) * 100)
                    : 0;
                const lColor = progressColor(lPct);
                return (
                  <div key={list.id} className="px-4 py-2.5">
                    <div className="flex items-center justify-between mb-1.5">
                      <span
                        className="text-xs font-medium truncate flex-1 mr-3"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {list.name}
                      </span>
                      <span className="text-xs flex-shrink-0" style={{ color: "var(--text-secondary)" }}>
                        {list.task_counts.done}/{list.task_counts.total}
                      </span>
                      <span
                        className="text-xs font-bold ml-2 w-8 text-right flex-shrink-0"
                        style={{ color: lColor }}
                      >
                        {lPct}%
                      </span>
                    </div>
                    <ProgressBar value={lPct} color={lColor} />
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

function GoalCard({ goal }: { goal: GoalEntry }) {
  const [expanded, setExpanded] = useState(false);
  const color = progressColor(goal.progress);
  const isOverdue =
    goal.due_date && new Date(goal.due_date).toISOString().slice(0, 10) < new Date().toISOString().slice(0, 10);

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}
    >
      <div className="p-4">
        <div className="flex items-start gap-4">
          {/* Progress ring */}
          <div className="flex-shrink-0">
            <ProgressRing percent={goal.progress} />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0 pt-1">
            <h3
              className="text-sm font-semibold mb-1"
              style={{ color: "var(--text-primary)" }}
            >
              {goal.title}
            </h3>
            {goal.due_date && (
              <p
                className="text-xs mb-2"
                style={{ color: isOverdue ? "#ef4444" : "var(--text-secondary)" }}
              >
                Due {new Date(goal.due_date).toLocaleDateString()}
                {isOverdue && " — overdue"}
              </p>
            )}
            <div className="flex items-center gap-2">
              <span
                className="text-xs px-2 py-0.5 rounded-full font-semibold"
                style={{ background: `${color}1a`, color }}
              >
                {goal.progress}% complete
              </span>
              <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                {goal.key_results.length} key result{goal.key_results.length !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Key results */}
      {goal.key_results.length > 0 && (
        <>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="w-full flex items-center gap-2 px-4 py-2 text-xs font-medium transition-colors hover:bg-white/10 border-t"
            style={{
              color: "var(--text-secondary)",
              borderColor: "var(--border)",
              background: "transparent",
            }}
          >
            {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            Key results
          </button>

          {expanded && (
            <div className="border-t px-4 pb-4 pt-3" style={{ borderColor: "var(--border)" }}>
              <div className="space-y-3">
                {goal.key_results.map((kr) => {
                  const krColor = progressColor(kr.progress);
                  return (
                    <div key={kr.id}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span
                          className="text-xs flex-1 mr-3 truncate"
                          style={{ color: "var(--text-primary)" }}
                        >
                          {kr.title}
                        </span>
                        <span className="text-xs flex-shrink-0" style={{ color: "var(--text-secondary)" }}>
                          {kr.current_value}/{kr.target_value} {kr.unit}
                        </span>
                        <span
                          className="text-xs font-bold ml-2 w-8 text-right flex-shrink-0"
                          style={{ color: krColor }}
                        >
                          {kr.progress}%
                        </span>
                      </div>
                      <ProgressBar value={kr.progress} color={krColor} />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SkeletonCard({ tall = false }: { tall?: boolean }) {
  return (
    <div
      className="rounded-xl border animate-pulse"
      style={{
        background: "var(--bg-secondary)",
        borderColor: "var(--border)",
        height: tall ? 160 : 120,
      }}
    />
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function PortfolioPage() {
  const [data, setData] = useState<PortfolioData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/portfolio")
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const totals = data?.totals ?? {
    spaces: 0,
    total_tasks: 0,
    done_tasks: 0,
    overdue_tasks: 0,
    completion_rate: 0,
  };

  return (
    <div className="p-6 overflow-y-auto h-full">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
            Portfolio
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
            Executive view across all workspaces
          </p>
        </div>

        {loading ? (
          <>
            {/* Skeleton stat tiles */}
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
                      <div
                        className="h-2.5 rounded w-20"
                        style={{ background: "var(--bg-primary)" }}
                      />
                      <div
                        className="h-5 rounded w-10"
                        style={{ background: "var(--bg-primary)" }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="space-y-3">
                {[1, 2, 3].map((i) => <SkeletonCard key={i} tall />)}
              </div>
              <div className="space-y-3">
                {[1, 2].map((i) => <SkeletonCard key={i} tall />)}
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Summary stat tiles */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
              <StatTile
                icon={BarChart3}
                label="Total tasks"
                value={totals.total_tasks}
                sub={`${totals.spaces} space${totals.spaces !== 1 ? "s" : ""}`}
                color="#3b82f6"
              />
              <StatTile
                icon={CheckCircle2}
                label="Completed"
                value={totals.done_tasks}
                sub={`${totals.total_tasks - totals.done_tasks} remaining`}
                color="#22c55e"
              />
              <StatTile
                icon={AlertCircle}
                label="Overdue"
                value={totals.overdue_tasks}
                color="#ef4444"
              />
              <StatTile
                icon={TrendingUp}
                label="Completion"
                value={`${totals.completion_rate}%`}
                sub={`${totals.done_tasks} of ${totals.total_tasks} done`}
                color="#7c3aed"
              />
            </div>

            {/* Main grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left: Spaces */}
              <div>
                <h2
                  className="text-sm font-semibold mb-3"
                  style={{ color: "var(--text-primary)" }}
                >
                  Spaces
                </h2>
                {data?.spaces.length === 0 ? (
                  <div
                    className="rounded-xl border text-center py-12"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <BarChart3
                      size={28}
                      className="mx-auto mb-3 opacity-20"
                      style={{ color: "var(--text-secondary)" }}
                    />
                    <p className="text-sm font-medium mb-1" style={{ color: "var(--text-primary)" }}>
                      No spaces yet
                    </p>
                    <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                      Create a space to start tracking progress
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {data?.spaces.map((space) => (
                      <SpaceCard key={space.id} space={space} />
                    ))}
                  </div>
                )}
              </div>

              {/* Right: Goals */}
              <div>
                <h2
                  className="text-sm font-semibold mb-3"
                  style={{ color: "var(--text-primary)" }}
                >
                  Goals & OKRs
                </h2>
                {data?.goals.length === 0 ? (
                  <div
                    className="rounded-xl border text-center py-12"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <Target
                      size={28}
                      className="mx-auto mb-3 opacity-20"
                      style={{ color: "var(--text-secondary)" }}
                    />
                    <p className="text-sm font-medium mb-1" style={{ color: "var(--text-primary)" }}>
                      No goals yet
                    </p>
                    <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                      Set goals in the Goals section to track them here
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {data?.goals.map((goal) => (
                      <GoalCard key={goal.id} goal={goal} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
