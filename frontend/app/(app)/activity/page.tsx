"use client";
import { useEffect, useState, useCallback } from "react";
import { Activity, FileText, Target, Users, CheckSquare, Loader2, ChevronDown } from "lucide-react";

interface ActivityEntry {
  id: string;
  user_id: string | null;
  user_name: string;
  entity_type: string;
  entity_id: string;
  entity_name: string | null;
  action: string;
  old_value: unknown;
  new_value: unknown;
  created_at: string;
}

type Filter = "all" | "task" | "doc" | "goal" | "space";

const FILTERS: { key: Filter; label: string; icon: React.ReactNode }[] = [
  { key: "all", label: "All", icon: <Activity size={13} /> },
  { key: "task", label: "Tasks", icon: <CheckSquare size={13} /> },
  { key: "doc", label: "Docs", icon: <FileText size={13} /> },
  { key: "goal", label: "Goals", icon: <Target size={13} /> },
  { key: "space", label: "Members", icon: <Users size={13} /> },
];

const ACTION_LABELS: Record<string, string> = {
  created: "created",
  updated: "updated",
  deleted: "deleted",
  commented: "commented on",
  status_changed: "changed status of",
  assigned: "was assigned to",
};

const ENTITY_COLORS: Record<string, string> = {
  task: "#7c3aed",
  doc: "#3b82f6",
  goal: "#22c55e",
  space: "#f59e0b",
  list: "#94a3b8",
};

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return "just now";
  if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? "s" : ""} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? "s" : ""} ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: diffDays > 365 ? "numeric" : undefined });
}

function UserAvatar({ name }: { name: string }) {
  const initial = name?.[0]?.toUpperCase() ?? "?";
  // Generate a consistent color from the name
  const colors = ["#7c3aed", "#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#ec4899", "#06b6d4"];
  const idx = name.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) % colors.length;
  return (
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
      style={{ background: colors[idx] }}
    >
      {initial}
    </div>
  );
}

function ActionDescription({ entry }: { entry: ActivityEntry }) {
  const actionLabel = ACTION_LABELS[entry.action] ?? entry.action;
  const entityColor = ENTITY_COLORS[entry.entity_type] ?? "var(--text-secondary)";

  return (
    <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
      <span className="font-medium" style={{ color: "var(--text-primary)" }}>{entry.user_name}</span>
      {" "}{actionLabel}{" "}
      {entry.entity_name ? (
        <span className="font-medium" style={{ color: entityColor }}>
          {entry.entity_name}
        </span>
      ) : (
        <span className="font-medium" style={{ color: entityColor }}>
          {entry.entity_type}
        </span>
      )}
    </span>
  );
}

function EntityBadge({ type }: { type: string }) {
  const color = ENTITY_COLORS[type] ?? "var(--text-secondary)";
  return (
    <span
      className="text-xs px-1.5 py-0.5 rounded-full capitalize font-medium"
      style={{ background: `${color}20`, color }}
    >
      {type}
    </span>
  );
}

export default function ActivityPage() {
  const [logs, setLogs] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const LIMIT = 50;

  const fetchLogs = useCallback(async (currentFilter: Filter, currentOffset: number, append = false) => {
    if (currentOffset === 0) setLoading(true);
    else setLoadingMore(true);

    try {
      const params = new URLSearchParams({ limit: String(LIMIT), offset: String(currentOffset) });
      if (currentFilter !== "all") params.set("entity_type", currentFilter);

      const res = await fetch(`/api/activity-log?${params}`);
      if (!res.ok) return;
      const { logs: newLogs } = await res.json();

      if (append) {
        setLogs((prev) => [...prev, ...(newLogs ?? [])]);
      } else {
        setLogs(newLogs ?? []);
      }

      setHasMore((newLogs ?? []).length === LIMIT);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    setOffset(0);
    setHasMore(true);
    fetchLogs(filter, 0, false);
  }, [filter, fetchLogs]);

  function loadMore() {
    const next = offset + LIMIT;
    setOffset(next);
    fetchLogs(filter, next, true);
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto p-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(124,58,237,0.15)" }}
            >
              <Activity size={18} style={{ color: "var(--accent-purple)" }} />
            </div>
            <div>
              <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Activity</h1>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Recent workspace activity</p>
            </div>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-1 mb-6 p-1 rounded-xl" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex-1 justify-center"
              style={
                filter === f.key
                  ? { background: "var(--accent-purple)", color: "white" }
                  : { color: "var(--text-secondary)", background: "transparent" }
              }
            >
              {f.icon}
              {f.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="animate-spin" style={{ color: "var(--text-secondary)" }} />
          </div>
        ) : logs.length === 0 ? (
          <div
            className="rounded-2xl border flex flex-col items-center justify-center py-20 px-8 text-center"
            style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}
          >
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: "rgba(124,58,237,0.1)" }}
            >
              <Activity size={28} style={{ color: "var(--accent-purple)", opacity: 0.6 }} />
            </div>
            <h3 className="text-base font-semibold mb-2" style={{ color: "var(--text-primary)" }}>No activity yet</h3>
            <p className="text-sm max-w-xs" style={{ color: "var(--text-secondary)" }}>
              Activity will appear here as you and your team create tasks, update docs, and collaborate.
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {logs.map((entry, idx) => {
              const prevEntry = idx > 0 ? logs[idx - 1] : null;
              const showDateDivider =
                !prevEntry ||
                new Date(prevEntry.created_at).toDateString() !== new Date(entry.created_at).toDateString();

              const dateLabel = (() => {
                const d = new Date(entry.created_at);
                const today = new Date();
                const yesterday = new Date(today);
                yesterday.setDate(yesterday.getDate() - 1);
                if (d.toDateString() === today.toDateString()) return "Today";
                if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
                return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
              })();

              return (
                <div key={entry.id}>
                  {showDateDivider && (
                    <div className="flex items-center gap-3 py-3">
                      <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
                      <span className="text-xs font-medium px-2" style={{ color: "var(--text-secondary)" }}>
                        {dateLabel}
                      </span>
                      <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
                    </div>
                  )}
                  <div
                    className="flex items-start gap-3 p-3 rounded-xl transition-colors hover:bg-white/[0.03] group"
                  >
                    <UserAvatar name={entry.user_name} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <ActionDescription entry={entry} />
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <EntityBadge type={entry.entity_type} />
                          <span className="text-xs whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
                            {timeAgo(entry.created_at)}
                          </span>
                        </div>
                      </div>
                      {/* Show value change if present */}
                      {entry.action === "status_changed" && !!entry.old_value && !!entry.new_value && (
                        <div className="flex items-center gap-2 mt-1.5">
                          <span
                            className="text-xs px-2 py-0.5 rounded-md"
                            style={{ background: "var(--bg-primary)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
                          >
                            {String(entry.old_value)}
                          </span>
                          <span className="text-xs" style={{ color: "var(--text-secondary)" }}>→</span>
                          <span
                            className="text-xs px-2 py-0.5 rounded-md"
                            style={{ background: "rgba(124,58,237,0.1)", color: "var(--accent-purple)", border: "1px solid rgba(124,58,237,0.2)" }}
                          >
                            {String(entry.new_value)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Load more */}
            {hasMore && (
              <div className="pt-4 flex justify-center">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
                  style={{ background: "var(--bg-secondary)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
                >
                  {loadingMore ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <ChevronDown size={14} />
                  )}
                  Load more
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
