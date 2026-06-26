"use client";
import { useEffect, useRef, useState } from "react";
import { useTasksStore } from "@/store/tasks";
import { useWorkspaceStore, Task } from "@/store/workspace";
import { useMembers, getMemberName } from "@/hooks/useMembers";
import { X, Flag, Calendar, Tag, AlignLeft, Trash2, User, Clock, Play, Square, Plus } from "lucide-react";

const PRIORITY_COLOR: Record<Task["priority"], string> = {
  urgent: "#ef4444", high: "#f97316", normal: "#94a3b8", low: "#64748b",
};

const STATUSES: { key: Task["status"]; label: string; color: string }[] = [
  { key: "todo", label: "To Do", color: "#94a3b8" },
  { key: "in_progress", label: "In Progress", color: "#3b82f6" },
  { key: "in_review", label: "In Review", color: "#f59e0b" },
  { key: "done", label: "Done", color: "#22c55e" },
];

interface TimeLog { id: string; duration_minutes: number; note: string; logged_at: string; }

function fmtTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export default function TaskDetailPanel() {
  const { selectedTaskId, setSelectedTask } = useWorkspaceStore();
  const { tasks, updateTask, deleteTask } = useTasksStore();
  const members = useMembers();
  const task = Object.values(tasks).flat().find((t) => t.id === selectedTaskId);

  const [editingTitle, setEditingTitle] = useState(false);
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [tagInput, setTagInput] = useState("");

  // Time tracking
  const [timeLogs, setTimeLogs] = useState<TimeLog[]>([]);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerSecs, setTimerSecs] = useState(0);
  const [manualMins, setManualMins] = useState("");
  const [manualNote, setManualNote] = useState("");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!selectedTaskId) return;
    fetch(`/api/time-logs?taskId=${selectedTaskId}`).then((r) => r.json()).then((d) => { if (Array.isArray(d)) setTimeLogs(d); }).catch(() => {});
  }, [selectedTaskId]);

  useEffect(() => {
    if (timerRunning) {
      timerRef.current = setInterval(() => setTimerSecs((s) => s + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [timerRunning]);

  if (!task || !selectedTaskId) return null;
  const taskId = selectedTaskId;
  const status = STATUSES.find((s) => s.key === task.status);
  const totalMinutes = timeLogs.reduce((s, l) => s + l.duration_minutes, 0);

  function addTag() {
    const t = tagInput.trim();
    if (!t || task!.tags.includes(t)) return;
    updateTask(taskId, { tags: [...task!.tags, t] });
    setTagInput("");
  }

  function handleDelete() {
    if (!confirm("Delete this task?")) return;
    deleteTask(taskId);
    setSelectedTask(null);
  }

  function stopTimer() {
    setTimerRunning(false);
    const mins = Math.ceil(timerSecs / 60);
    setTimerSecs(0);
    if (mins < 1) return;
    logTime(mins, "Timer");
  }

  async function logTime(mins: number, note: string) {
    const log = { task_id: taskId, duration_minutes: mins, note };
    const res = await fetch("/api/time-logs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(log) });
    if (res.ok) { const saved = await res.json(); setTimeLogs((l) => [saved, ...l]); }
  }

  async function logManual() {
    const mins = parseInt(manualMins);
    if (!mins || mins < 1) return;
    await logTime(mins, manualNote || "Manual entry");
    setManualMins("");
    setManualNote("");
  }

  async function deleteLog(id: string) {
    setTimeLogs((l) => l.filter((x) => x.id !== id));
    await fetch("/api/time-logs", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
  }

  return (
    <div className="flex flex-col border-l overflow-y-auto flex-shrink-0"
      style={{ width: 380, background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0" style={{ borderColor: "var(--border)" }}>
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>Task Detail</span>
        <div className="flex items-center gap-1">
          <button onClick={handleDelete} className="p-1 rounded hover:bg-red-500/10 transition-colors" style={{ color: "var(--danger)" }}><Trash2 size={14} /></button>
          <button onClick={() => setSelectedTask(null)} className="p-1 rounded hover:bg-white/10 transition-colors" style={{ color: "var(--text-secondary)" }}><X size={15} /></button>
        </div>
      </div>

      <div className="p-4 space-y-5 flex-1">
        {/* Title */}
        {editingTitle ? (
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)}
            onBlur={() => { updateTask(taskId, { title }); setEditingTitle(false); }}
            onKeyDown={(e) => { if (e.key === "Enter") { updateTask(taskId, { title }); setEditingTitle(false); } if (e.key === "Escape") setEditingTitle(false); }}
            className="w-full bg-transparent outline-none text-lg font-semibold border-b pb-1"
            style={{ color: "var(--text-primary)", borderColor: "var(--accent-purple)" }} />
        ) : (
          <h2 onClick={() => { setTitle(task.title); setEditingTitle(true); }}
            className="text-lg font-semibold cursor-text hover:opacity-80 transition-opacity" style={{ color: "var(--text-primary)" }}>
            {task.title}
          </h2>
        )}

        {/* Status + Priority */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs mb-1.5 font-medium uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>Status</p>
            <select value={task.status} onChange={(e) => updateTask(taskId, { status: e.target.value as Task["status"] })}
              className="w-full text-xs px-2 py-1.5 rounded-lg outline-none appearance-none cursor-pointer"
              style={{ background: `${status?.color}22`, color: status?.color, border: `1px solid ${status?.color}44` }}>
              {STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <p className="text-xs mb-1.5 font-medium uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>Priority</p>
            <select value={task.priority} onChange={(e) => updateTask(taskId, { priority: e.target.value as Task["priority"] })}
              className="w-full text-xs px-2 py-1.5 rounded-lg outline-none appearance-none cursor-pointer"
              style={{ background: `${PRIORITY_COLOR[task.priority]}22`, color: PRIORITY_COLOR[task.priority], border: `1px solid ${PRIORITY_COLOR[task.priority]}44` }}>
              {(["urgent","high","normal","low"] as Task["priority"][]).map((p) => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
            </select>
          </div>
        </div>

        {/* Assignee */}
        <div>
          <p className="text-xs mb-1.5 font-medium uppercase tracking-wide flex items-center gap-1" style={{ color: "var(--text-secondary)" }}>
            <User size={11} /> Assignee
          </p>
          <select value={task.assignee ?? ""}
            onChange={(e) => updateTask(taskId, { assignee: e.target.value || undefined })}
            className="w-full text-xs px-2 py-1.5 rounded-lg outline-none appearance-none cursor-pointer"
            style={{ background: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }}>
            <option value="">Unassigned</option>
            {members.map((m) => <option key={m.id} value={m.id}>{m.full_name || m.id.slice(0, 8)}</option>)}
          </select>
          {task.assignee && (
            <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
              Assigned to {getMemberName(members, task.assignee)}
            </p>
          )}
        </div>

        {/* Due date */}
        <div>
          <p className="text-xs mb-1.5 font-medium uppercase tracking-wide flex items-center gap-1" style={{ color: "var(--text-secondary)" }}>
            <Calendar size={11} /> Due Date
          </p>
          <input type="date" value={task.due_date ?? ""}
            onChange={(e) => updateTask(taskId, { due_date: e.target.value })}
            className="text-xs px-2 py-1.5 rounded-lg outline-none"
            style={{ background: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }} />
        </div>

        {/* Description */}
        <div>
          <p className="text-xs mb-1.5 font-medium uppercase tracking-wide flex items-center gap-1" style={{ color: "var(--text-secondary)" }}>
            <AlignLeft size={11} /> Description
          </p>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)}
            onBlur={() => updateTask(taskId, { description })}
            placeholder="Add a description..." rows={3}
            className="w-full text-sm px-3 py-2 rounded-lg outline-none resize-none"
            style={{ background: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }} />
        </div>

        {/* Tags */}
        <div>
          <p className="text-xs mb-1.5 font-medium uppercase tracking-wide flex items-center gap-1" style={{ color: "var(--text-secondary)" }}>
            <Tag size={11} /> Tags
          </p>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {task.tags.map((tag) => (
              <span key={tag} className="text-xs px-2 py-0.5 rounded-full flex items-center gap-1"
                style={{ background: "var(--bg-surface)", color: "var(--text-secondary)" }}>
                {tag}
                <button onClick={() => updateTask(taskId, { tags: task.tags.filter((t) => t !== tag) })} className="hover:text-white ml-0.5">×</button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addTag()}
              placeholder="Add tag..." className="flex-1 text-xs px-2 py-1.5 rounded-lg outline-none"
              style={{ background: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }} />
            <button onClick={addTag} className="text-xs px-2 py-1.5 rounded-lg" style={{ background: "var(--accent-purple)", color: "white" }}>Add</button>
          </div>
        </div>

        {/* Time tracking */}
        <div>
          <p className="text-xs mb-2 font-medium uppercase tracking-wide flex items-center gap-1" style={{ color: "var(--text-secondary)" }}>
            <Clock size={11} /> Time Tracked
            {totalMinutes > 0 && <span className="ml-auto font-bold" style={{ color: "var(--accent-purple)" }}>{fmtTime(totalMinutes)}</span>}
          </p>

          {/* Timer */}
          <div className="flex items-center gap-2 mb-3">
            {timerRunning ? (
              <button onClick={stopTimer} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg text-white"
                style={{ background: "var(--danger)" }}>
                <Square size={11} /> Stop {timerSecs > 0 && `(${Math.floor(timerSecs/60)}:${String(timerSecs%60).padStart(2,"0")})`}
              </button>
            ) : (
              <button onClick={() => setTimerRunning(true)} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg"
                style={{ background: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }}>
                <Play size={11} style={{ color: "#22c55e" }} /> Start timer
              </button>
            )}
          </div>

          {/* Manual entry */}
          <div className="flex gap-2 mb-3">
            <input type="number" value={manualMins} onChange={(e) => setManualMins(e.target.value)} min="1" placeholder="mins"
              className="w-16 text-xs px-2 py-1.5 rounded-lg outline-none text-center"
              style={{ background: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }} />
            <input value={manualNote} onChange={(e) => setManualNote(e.target.value)} placeholder="Note (optional)"
              className="flex-1 text-xs px-2 py-1.5 rounded-lg outline-none"
              style={{ background: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }} />
            <button onClick={logManual} className="text-xs px-2 py-1.5 rounded-lg"
              style={{ background: "var(--bg-primary)", color: "var(--accent-purple)", border: "1px solid var(--border)" }}>
              <Plus size={13} />
            </button>
          </div>

          {/* Log history */}
          {timeLogs.length > 0 && (
            <div className="space-y-1.5">
              {timeLogs.slice(0, 5).map((log) => (
                <div key={log.id} className="flex items-center justify-between text-xs py-1 rounded px-2"
                  style={{ background: "var(--bg-primary)" }}>
                  <span style={{ color: "var(--text-secondary)" }}>{log.note || "Logged"}</span>
                  <div className="flex items-center gap-2">
                    <span style={{ color: "var(--accent-purple)", fontWeight: 600 }}>{fmtTime(log.duration_minutes)}</span>
                    <button onClick={() => deleteLog(log.id)} className="opacity-50 hover:opacity-100" style={{ color: "var(--danger)" }}>×</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Activity */}
        <div>
          <p className="text-xs mb-2 font-medium uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>Activity</p>
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>Task created {new Date(task.created_at).toLocaleDateString()}</p>
        </div>
      </div>
    </div>
  );
}
