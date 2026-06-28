"use client";
import { useEffect, useRef, useState } from "react";
import { useTasksStore } from "@/store/tasks";
import { useWorkspaceStore, Task } from "@/store/workspace";
import { useMembers, getMemberName } from "@/hooks/useMembers";
import { X, Flag, Calendar, Tag, AlignLeft, Trash2, User, Clock, Play, Square, Plus, CheckSquare, Square as SquareIcon, MessageCircle, Send } from "lucide-react";

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
interface Subtask { id: string; task_id: string; title: string; completed: boolean; position: number; }
interface Comment { id: string; task_id: string; user_id: string; content: string; created_at: string; profiles?: { full_name: string }; }

function fmtTime(mins: number): string {
  const h = Math.floor(mins / 60), m = mins % 60;
  return h === 0 ? `${m}m` : m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs mb-2 font-semibold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>{title}</p>
      {children}
    </div>
  );
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

  // Subtasks
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [newSubtask, setNewSubtask] = useState("");

  // Comments
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [sendingComment, setSendingComment] = useState(false);

  // Time tracking
  const [timeLogs, setTimeLogs] = useState<TimeLog[]>([]);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerSecs, setTimerSecs] = useState(0);
  const [manualMins, setManualMins] = useState("");
  const [manualNote, setManualNote] = useState("");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!selectedTaskId) return;
    setSubtasks([]);
    setComments([]);
    setTimeLogs([]);
    fetch(`/api/subtasks?taskId=${selectedTaskId}`).then((r) => r.json()).then((d) => Array.isArray(d) && setSubtasks(d)).catch(() => {});
    fetch(`/api/comments?taskId=${selectedTaskId}`).then((r) => r.json()).then((d) => Array.isArray(d) && setComments(d)).catch(() => {});
    fetch(`/api/time-logs?taskId=${selectedTaskId}`).then((r) => r.json()).then((d) => Array.isArray(d) && setTimeLogs(d)).catch(() => {});
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
  const subtasksDone = subtasks.filter((s) => s.completed).length;

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

  async function addSubtask() {
    const title = newSubtask.trim();
    if (!title) return;
    setNewSubtask("");
    const opt: Subtask = { id: `st${Date.now()}`, task_id: taskId, title, completed: false, position: subtasks.length };
    setSubtasks((s) => [...s, opt]);
    const res = await fetch("/api/subtasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(opt) });
    if (res.ok) { const saved = await res.json(); setSubtasks((s) => s.map((x) => x.id === opt.id ? saved : x)); }
  }

  async function toggleSubtask(id: string, completed: boolean) {
    setSubtasks((s) => s.map((x) => x.id === id ? { ...x, completed } : x));
    await fetch("/api/subtasks", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, completed }) });
  }

  async function deleteSubtask(id: string) {
    setSubtasks((s) => s.filter((x) => x.id !== id));
    await fetch("/api/subtasks", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
  }

  async function sendComment() {
    if (!commentText.trim()) return;
    setSendingComment(true);
    try {
      const res = await fetch("/api/comments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ task_id: taskId, content: commentText.trim() }) });
      if (res.ok) { const saved = await res.json(); setComments((c) => [...c, saved]); setCommentText(""); }
    } finally {
      setSendingComment(false);
    }
  }

  async function deleteComment(id: string) {
    setComments((c) => c.filter((x) => x.id !== id));
    await fetch("/api/comments", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
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
    setManualMins(""); setManualNote("");
  }

  return (
    <div className="flex flex-col border-l overflow-y-auto flex-shrink-0"
      style={{ width: 380, background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0" style={{ borderColor: "var(--border)" }}>
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>Task Detail</span>
        <div className="flex items-center gap-1">
          <button onClick={handleDelete} className="p-1 rounded hover:bg-red-500/10" style={{ color: "var(--danger)" }}><Trash2 size={14} /></button>
          <button onClick={() => setSelectedTask(null)} className="p-1 rounded hover:bg-white/10" style={{ color: "var(--text-secondary)" }}><X size={15} /></button>
        </div>
      </div>

      <div className="p-4 space-y-5">
        {/* Title */}
        {editingTitle ? (
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)}
            onBlur={() => { updateTask(taskId, { title }); setEditingTitle(false); }}
            onKeyDown={(e) => { if (e.key === "Enter") { updateTask(taskId, { title }); setEditingTitle(false); } if (e.key === "Escape") setEditingTitle(false); }}
            className="w-full bg-transparent outline-none text-lg font-semibold border-b pb-1"
            style={{ color: "var(--text-primary)", borderColor: "var(--accent-purple)" }} />
        ) : (
          <h2 onClick={() => { setTitle(task.title); setEditingTitle(true); }}
            className="text-lg font-semibold cursor-text hover:opacity-80" style={{ color: "var(--text-primary)" }}>
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

        {/* Assignee + Due date */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs mb-1.5 font-medium uppercase tracking-wide flex items-center gap-1" style={{ color: "var(--text-secondary)" }}>
              <User size={10} /> Assignee
            </p>
            <select value={task.assignee ?? ""}
              onChange={(e) => updateTask(taskId, { assignee: e.target.value || undefined })}
              className="w-full text-xs px-2 py-1.5 rounded-lg outline-none appearance-none cursor-pointer"
              style={{ background: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }}>
              <option value="">Unassigned</option>
              {members.map((m) => <option key={m.id} value={m.id}>{m.full_name || "?"}</option>)}
            </select>
          </div>
          <div>
            <p className="text-xs mb-1.5 font-medium uppercase tracking-wide flex items-center gap-1" style={{ color: "var(--text-secondary)" }}>
              <Calendar size={10} /> Due Date
            </p>
            <input type="date" value={task.due_date ?? ""}
              onChange={(e) => updateTask(taskId, { due_date: e.target.value })}
              className="w-full text-xs px-2 py-1.5 rounded-lg outline-none"
              style={{ background: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }} />
          </div>
        </div>

        {/* Description */}
        <Section title="Description">
          <textarea value={description} onChange={(e) => setDescription(e.target.value)}
            onBlur={() => updateTask(taskId, { description })}
            placeholder="Add a description..." rows={3}
            className="w-full text-sm px-3 py-2 rounded-lg outline-none resize-none"
            style={{ background: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }} />
        </Section>

        {/* Subtasks */}
        <Section title={`Subtasks${subtasks.length ? ` · ${subtasksDone}/${subtasks.length}` : ""}`}>
          {subtasks.length > 0 && (
            <div className="mb-2">
              {/* Progress bar */}
              <div className="h-1 rounded-full mb-2" style={{ background: "var(--bg-primary)" }}>
                <div className="h-1 rounded-full transition-all" style={{ width: `${subtasks.length ? (subtasksDone/subtasks.length)*100 : 0}%`, background: "#22c55e" }} />
              </div>
              <div className="space-y-1">
                {subtasks.map((st) => (
                  <div key={st.id} className="flex items-center gap-2 group">
                    <button onClick={() => toggleSubtask(st.id, !st.completed)} className="flex-shrink-0">
                      {st.completed
                        ? <CheckSquare size={14} style={{ color: "#22c55e" }} />
                        : <SquareIcon size={14} style={{ color: "var(--text-secondary)" }} />}
                    </button>
                    <span className="text-xs flex-1" style={{ color: "var(--text-primary)", textDecoration: st.completed ? "line-through" : "none", opacity: st.completed ? 0.5 : 1 }}>
                      {st.title}
                    </span>
                    <button onClick={() => deleteSubtask(st.id)} className="opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "var(--danger)" }}>
                      <X size={11} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <input value={newSubtask} onChange={(e) => setNewSubtask(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addSubtask()}
              placeholder="Add subtask..."
              className="flex-1 text-xs px-2 py-1.5 rounded-lg outline-none"
              style={{ background: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }} />
            <button onClick={addSubtask} className="text-xs px-2 py-1.5 rounded-lg" style={{ background: "var(--accent-purple)", color: "white" }}>
              <Plus size={12} />
            </button>
          </div>
        </Section>

        {/* Tags */}
        <Section title="Tags">
          <div className="flex flex-wrap gap-1.5 mb-2">
            {task.tags.map((tag) => (
              <span key={tag} className="text-xs px-2 py-0.5 rounded-full flex items-center gap-1"
                style={{ background: "var(--bg-primary)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
                {tag}
                <button onClick={() => updateTask(taskId, { tags: task.tags.filter((t) => t !== tag) })} className="hover:text-white ml-0.5">×</button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addTag()}
              placeholder="Add tag..."
              className="flex-1 text-xs px-2 py-1.5 rounded-lg outline-none"
              style={{ background: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }} />
            <button onClick={addTag} className="text-xs px-2 py-1.5 rounded-lg" style={{ background: "var(--accent-purple)", color: "white" }}>Add</button>
          </div>
        </Section>

        {/* Time tracking */}
        <Section title={`Time${totalMinutes > 0 ? ` · ${fmtTime(totalMinutes)}` : ""}`}>
          <div className="flex items-center gap-2 mb-2">
            {timerRunning ? (
              <button onClick={stopTimer} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg text-white"
                style={{ background: "var(--danger)" }}>
                <Square size={11} /> Stop {timerSecs > 0 && `(${Math.floor(timerSecs/60)}:${String(timerSecs%60).padStart(2,"0")})`}
              </button>
            ) : (
              <button onClick={() => setTimerRunning(true)}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg"
                style={{ background: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }}>
                <Play size={11} style={{ color: "#22c55e" }} /> Start timer
              </button>
            )}
            <div className="flex gap-1.5 flex-1">
              <input type="number" value={manualMins} onChange={(e) => setManualMins(e.target.value)} min="1" placeholder="min"
                className="w-14 text-xs px-2 py-1.5 rounded-lg outline-none text-center"
                style={{ background: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }} />
              <input value={manualNote} onChange={(e) => setManualNote(e.target.value)} placeholder="Note"
                className="flex-1 text-xs px-2 py-1.5 rounded-lg outline-none min-w-0"
                style={{ background: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }} />
              <button onClick={logManual} className="text-xs px-2 py-1.5 rounded-lg flex-shrink-0"
                style={{ background: "var(--bg-primary)", color: "var(--accent-purple)", border: "1px solid var(--border)" }}>
                <Plus size={12} />
              </button>
            </div>
          </div>
          {timeLogs.slice(0, 4).map((log) => (
            <div key={log.id} className="flex items-center justify-between text-xs py-1 px-2 rounded mb-1"
              style={{ background: "var(--bg-primary)" }}>
              <span style={{ color: "var(--text-secondary)" }}>{log.note || "Logged"}</span>
              <div className="flex items-center gap-2">
                <span style={{ color: "var(--accent-purple)", fontWeight: 600 }}>{fmtTime(log.duration_minutes)}</span>
                <button onClick={async () => { setTimeLogs((l) => l.filter((x) => x.id !== log.id)); await fetch("/api/time-logs", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: log.id }) }); }}
                  className="opacity-50 hover:opacity-100" style={{ color: "var(--danger)" }}>×</button>
              </div>
            </div>
          ))}
        </Section>

        {/* Comments */}
        <Section title={`Comments${comments.length ? ` · ${comments.length}` : ""}`}>
          <div className="space-y-3 mb-3">
            {comments.length === 0 && (
              <p className="text-xs py-2 text-center" style={{ color: "var(--text-secondary)" }}>No comments yet</p>
            )}
            {comments.map((c) => (
              <div key={c.id} className="group">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
                    {c.profiles?.full_name || "You"}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                      {new Date(c.created_at).toLocaleDateString()}
                    </span>
                    <button onClick={() => deleteComment(c.id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-xs" style={{ color: "var(--danger)" }}>×</button>
                  </div>
                </div>
                <p className="text-xs leading-relaxed px-2 py-1.5 rounded-lg"
                  style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}>{c.content}</p>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input value={commentText} onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendComment(); } }}
              placeholder="Write a comment..."
              className="flex-1 text-xs px-3 py-2 rounded-lg outline-none"
              style={{ background: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }} />
            <button onClick={sendComment} disabled={sendingComment || !commentText.trim()}
              className="px-3 py-2 rounded-lg disabled:opacity-40 flex-shrink-0"
              style={{ background: "var(--accent-purple)", color: "white" }}>
              <Send size={13} />
            </button>
          </div>
        </Section>

        <p className="text-xs pb-2" style={{ color: "var(--text-secondary)" }}>
          Created {new Date(task.created_at).toLocaleDateString()}
        </p>
      </div>
    </div>
  );
}
