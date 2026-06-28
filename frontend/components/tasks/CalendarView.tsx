"use client";
import { useState, useEffect } from "react";
import { useTasksStore } from "@/store/tasks";
import { useWorkspaceStore, Task } from "@/store/workspace";
import { ChevronLeft, ChevronRight, Plus, Video } from "lucide-react";
import type { UnifiedCalendarEvent } from "@/app/api/calendar-events/route";

const DAYS   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const STATUS_COLOR: Record<Task["status"], string> = {
  todo: "#94a3b8", in_progress: "#3b82f6", in_review: "#f59e0b", done: "#22c55e",
};

const SOURCE_META: Record<UnifiedCalendarEvent["source"], { label: string; color: string; icon: string }> = {
  google:    { label: "Google",    color: "#4285F4", icon: "G" },
  microsoft: { label: "Microsoft", color: "#0078D4", icon: "M" },
  outlook:   { label: "Outlook",   color: "#0078D4", icon: "O" },
  apple:     { label: "Apple",     color: "#FF3B30", icon: "A" },
  zoom:      { label: "Zoom",      color: "#2D8CFF", icon: "Z" },
};

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export default function CalendarView({ listId }: { listId: string }) {
  const { tasks, addTask } = useTasksStore();
  const { setSelectedTask } = useWorkspaceStore();
  const listTasks = tasks[listId] || [];

  const today = new Date();
  const [current, setCurrent] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [calEvents, setCalEvents] = useState<UnifiedCalendarEvent[]>([]);
  const [activeSources, setActiveSources] = useState<Set<string>>(new Set());
  const [availableSources, setAvailableSources] = useState<UnifiedCalendarEvent["source"][]>([]);

  const year  = current.getFullYear();
  const month = current.getMonth();
  const firstDay    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  useEffect(() => {
    fetch("/api/calendar-events?days=90")
      .then(r => r.ok ? r.json() : { events: [], sources: [] })
      .then(({ events, sources }: { events: UnifiedCalendarEvent[]; sources: UnifiedCalendarEvent["source"][] }) => {
        setCalEvents(events);
        setAvailableSources(sources);
        setActiveSources(new Set(sources)); // all on by default
      })
      .catch(() => {});
  }, []);

  function toggleSource(src: string) {
    setActiveSources(prev => {
      const next = new Set(prev);
      next.has(src) ? next.delete(src) : next.add(src);
      return next;
    });
  }

  function dateKey(day: number) {
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  function tasksOnDay(day: number) {
    return listTasks.filter(t => t.due_date === dateKey(day));
  }

  function eventsOnDay(day: number): UnifiedCalendarEvent[] {
    const key = dateKey(day);
    return calEvents.filter(ev => {
      if (!activeSources.has(ev.source)) return false;
      return (ev.start.split("T")[0] === key);
    });
  }

  function handleDayClick(day: number) {
    const title = prompt("New task name:");
    if (!title?.trim()) return;
    addTask({
      id: `t${Date.now()}`, title: title.trim(), status: "todo", priority: "normal",
      list_id: listId, due_date: dateKey(day), position: listTasks.length, tags: [],
      created_at: new Date().toISOString(),
    });
  }

  const isToday = (day: number) =>
    day === today.getDate() && month === today.getMonth() && year === today.getFullYear();

  return (
    <div className="flex flex-col h-full p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
          {MONTHS[month]} {year}
        </h2>
        <div className="flex items-center gap-2">
          {/* Per-source toggles */}
          {availableSources.map(src => {
            const meta = SOURCE_META[src];
            const active = activeSources.has(src);
            return (
              <button key={src} onClick={() => toggleSource(src)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all"
                style={{
                  borderColor: active ? meta.color : "var(--border)",
                  background:  active ? `${meta.color}22` : "transparent",
                  color:       active ? meta.color : "var(--text-secondary)",
                }}>
                <Video size={10} /> {meta.label}
              </button>
            );
          })}
          <div className="w-px h-4 mx-1" style={{ background: "var(--border)" }} />
          <button onClick={() => setCurrent(new Date(year, month - 1, 1))}
            className="p-2 rounded-lg hover:bg-white/5 transition-colors" style={{ color: "var(--text-secondary)" }}>
            <ChevronLeft size={16} />
          </button>
          <button onClick={() => setCurrent(new Date(today.getFullYear(), today.getMonth(), 1))}
            className="px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-white/5 transition-colors"
            style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
            Today
          </button>
          <button onClick={() => setCurrent(new Date(year, month + 1, 1))}
            className="p-2 rounded-lg hover:bg-white/5 transition-colors" style={{ color: "var(--text-secondary)" }}>
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-2">
        {DAYS.map(d => (
          <div key={d} className="text-center text-xs font-semibold uppercase tracking-wide py-2"
            style={{ color: "var(--text-secondary)" }}>{d}</div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 flex-1 border-l border-t rounded-xl overflow-hidden"
        style={{ borderColor: "var(--border)" }}>
        {cells.map((day, i) => {
          const dayTasks  = day ? tasksOnDay(day)  : [];
          const dayEvents = day ? eventsOnDay(day) : [];
          const total = dayTasks.length + dayEvents.length;
          return (
            <div key={i} onClick={() => day && handleDayClick(day)}
              className="border-r border-b min-h-24 p-2 cursor-pointer group relative transition-colors hover:bg-white/2"
              style={{ borderColor: "var(--border)", background: day ? "var(--bg-secondary)" : "var(--bg-primary)" }}>
              {day && (
                <>
                  <div className="w-6 h-6 flex items-center justify-center text-xs font-medium rounded-full mb-1"
                    style={{ background: isToday(day) ? "var(--accent-purple)" : "transparent",
                             color: isToday(day) ? "white" : "var(--text-secondary)" }}>
                    {day}
                  </div>
                  <div className="space-y-0.5">
                    {/* Calendar events from integrations */}
                    {dayEvents.slice(0, 2).map(ev => {
                      const meta = SOURCE_META[ev.source];
                      return (
                        <div key={ev.id}
                          onClick={e => { e.stopPropagation(); window.open(ev.meetLink ?? ev.externalLink, "_blank"); }}
                          className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded truncate cursor-pointer hover:opacity-80"
                          style={{ background: `${meta.color}22`, color: meta.color, border: `1px solid ${meta.color}44` }}
                          title={`${ev.title}${ev.start.includes("T") ? ` · ${fmtTime(ev.start)}` : ""}`}>
                          <Video size={9} className="shrink-0" />
                          <span className="truncate">{ev.title}</span>
                        </div>
                      );
                    })}
                    {/* Tasks */}
                    {dayTasks.slice(0, Math.max(0, 3 - Math.min(dayEvents.length, 2))).map(t => (
                      <div key={t.id}
                        onClick={e => { e.stopPropagation(); setSelectedTask(t.id); }}
                        className="text-xs px-1.5 py-0.5 rounded truncate cursor-pointer hover:opacity-80"
                        style={{ background: `${STATUS_COLOR[t.status]}22`, color: STATUS_COLOR[t.status], border: `1px solid ${STATUS_COLOR[t.status]}44` }}>
                        {t.title}
                      </div>
                    ))}
                    {total > 3 && (
                      <p className="text-xs" style={{ color: "var(--text-secondary)" }}>+{total - 3} more</p>
                    )}
                  </div>
                  <button className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded"
                    style={{ color: "var(--text-secondary)" }}
                    onClick={e => { e.stopPropagation(); handleDayClick(day); }}>
                    <Plus size={11} />
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
