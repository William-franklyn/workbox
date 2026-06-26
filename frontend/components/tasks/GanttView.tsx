"use client";
import { useMemo, useRef, useState } from "react";
import { useTasksStore } from "@/store/tasks";
import { useWorkspaceStore, Task } from "@/store/workspace";
import { ChevronLeft, ChevronRight } from "lucide-react";

const STATUS_COLOR: Record<Task["status"], string> = {
  todo: "#94a3b8", in_progress: "#3b82f6", in_review: "#f59e0b", done: "#22c55e",
};

const DAY_W = 36; // px per day column
const ROW_H = 40;
const LABEL_W = 220;

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

export default function GanttView({ listId }: { listId: string }) {
  const { tasks, updateTask } = useTasksStore();
  const { setSelectedTask, selectedTaskId } = useWorkspaceStore();
  const listTasks = tasks[listId] || [];
  const scrollRef = useRef<HTMLDivElement>(null);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [anchor, setAnchor] = useState<Date>(() => {
    const d = new Date(today);
    d.setDate(1);
    return d;
  });

  const DAYS_SHOWN = 90;
  const days = useMemo(() => Array.from({ length: DAYS_SHOWN }, (_, i) => addDays(anchor, i)), [anchor]);

  const months = useMemo(() => {
    const ms: { label: string; start: number; span: number }[] = [];
    let cur = "";
    days.forEach((d, i) => {
      const m = d.toLocaleString("default", { month: "long", year: "numeric" });
      if (m !== cur) { ms.push({ label: m, start: i, span: 0 }); cur = m; }
      ms[ms.length - 1].span++;
    });
    return ms;
  }, [days]);

  const todayOffset = daysBetween(anchor, today);

  function taskBar(task: Task) {
    const start = task.created_at ? new Date(task.created_at.slice(0, 10)) : anchor;
    const end = task.due_date ? new Date(task.due_date) : addDays(start, 3);
    const left = Math.max(0, daysBetween(anchor, start));
    const right = Math.min(DAYS_SHOWN, daysBetween(anchor, addDays(end, 1)));
    const width = Math.max(1, right - left);
    return { left, width };
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b flex-shrink-0" style={{ borderColor: "var(--border)" }}>
        <button onClick={() => setAnchor((a) => addDays(a, -30))} className="p-1.5 rounded hover:bg-white/10" style={{ color: "var(--text-secondary)" }}>
          <ChevronLeft size={16} />
        </button>
        <button onClick={() => setAnchor(() => { const d = new Date(today); d.setDate(1); return d; })}
          className="text-xs px-3 py-1.5 rounded-lg hover:opacity-80" style={{ background: "var(--bg-secondary)", color: "var(--text-secondary)" }}>
          Today
        </button>
        <button onClick={() => setAnchor((a) => addDays(a, 30))} className="p-1.5 rounded hover:bg-white/10" style={{ color: "var(--text-secondary)" }}>
          <ChevronRight size={16} />
        </button>
        <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          {anchor.toLocaleString("default", { month: "long", year: "numeric" })}
        </span>
        <span className="ml-auto text-xs" style={{ color: "var(--text-secondary)" }}>{listTasks.length} tasks</span>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left labels */}
        <div className="flex-shrink-0 border-r" style={{ width: LABEL_W, borderColor: "var(--border)" }}>
          {/* Header spacer (month row + day row) */}
          <div style={{ height: ROW_H * 2, borderBottom: "1px solid var(--border)" }} />
          <div className="overflow-hidden" style={{ height: `calc(100% - ${ROW_H * 2}px)` }}>
            {listTasks.map((task) => (
              <div key={task.id}
                className="flex items-center px-3 cursor-pointer hover:bg-white/5 transition-colors"
                style={{ height: ROW_H, borderBottom: "1px solid var(--border)", background: selectedTaskId === task.id ? "rgba(124,58,237,0.1)" : "transparent" }}
                onClick={() => setSelectedTask(task.id)}>
                <span className="w-2 h-2 rounded-full flex-shrink-0 mr-2" style={{ background: STATUS_COLOR[task.status] }} />
                <span className="text-sm truncate" style={{ color: "var(--text-primary)" }}>{task.title}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Timeline */}
        <div ref={scrollRef} className="flex-1 overflow-x-auto overflow-y-hidden">
          <div style={{ width: DAYS_SHOWN * DAY_W, position: "relative" }}>
            {/* Month headers */}
            <div className="flex" style={{ height: ROW_H, borderBottom: "1px solid var(--border)" }}>
              {months.map((m) => (
                <div key={m.label} className="flex items-center px-2 border-r text-xs font-semibold"
                  style={{ width: m.span * DAY_W, flexShrink: 0, borderColor: "var(--border)", color: "var(--text-primary)", background: "var(--bg-secondary)" }}>
                  {m.label}
                </div>
              ))}
            </div>

            {/* Day headers */}
            <div className="flex" style={{ height: ROW_H, borderBottom: "1px solid var(--border)" }}>
              {days.map((d, i) => {
                const isToday = dateKey(d) === dateKey(today);
                const isSun = d.getDay() === 0;
                const isSat = d.getDay() === 6;
                return (
                  <div key={i} className="flex items-center justify-center text-xs border-r"
                    style={{
                      width: DAY_W, flexShrink: 0, borderColor: "var(--border)",
                      background: isToday ? "rgba(124,58,237,0.2)" : isSat || isSun ? "rgba(255,255,255,0.02)" : "transparent",
                      color: isToday ? "var(--accent-purple)" : isSat || isSun ? "var(--text-secondary)" : "var(--text-secondary)",
                      fontWeight: isToday ? 700 : 400,
                    }}>
                    {d.getDate()}
                  </div>
                );
              })}
            </div>

            {/* Today vertical line */}
            {todayOffset >= 0 && todayOffset < DAYS_SHOWN && (
              <div className="absolute top-0 bottom-0 pointer-events-none" style={{ left: todayOffset * DAY_W + DAY_W / 2, width: 2, background: "var(--accent-purple)", opacity: 0.6 }} />
            )}

            {/* Task rows */}
            {listTasks.map((task) => {
              const { left, width } = taskBar(task);
              const color = STATUS_COLOR[task.status];
              return (
                <div key={task.id}
                  className="relative"
                  style={{ height: ROW_H, borderBottom: "1px solid var(--border)", background: selectedTaskId === task.id ? "rgba(124,58,237,0.05)" : "transparent" }}>
                  {/* Weekend shading */}
                  {days.map((d, i) => (d.getDay() === 0 || d.getDay() === 6) ? (
                    <div key={i} style={{ position: "absolute", left: i * DAY_W, width: DAY_W, top: 0, bottom: 0, background: "rgba(255,255,255,0.02)" }} />
                  ) : null)}
                  {/* Task bar */}
                  <div
                    className="absolute cursor-pointer rounded"
                    style={{
                      left: left * DAY_W + 2,
                      width: width * DAY_W - 4,
                      top: 8, height: ROW_H - 16,
                      background: `${color}33`,
                      border: `1px solid ${color}88`,
                    }}
                    onClick={() => setSelectedTask(task.id)}
                    title={task.title}
                  >
                    {width > 2 && (
                      <span className="absolute inset-0 flex items-center px-1.5 text-xs truncate font-medium" style={{ color }}>
                        {task.title}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
