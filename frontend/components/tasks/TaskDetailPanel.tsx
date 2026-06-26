"use client";
import { useState } from "react";
import { useTasksStore } from "@/store/tasks";
import { useWorkspaceStore, Task } from "@/store/workspace";
import { X, Flag, Calendar, Tag, AlignLeft, Trash2 } from "lucide-react";

const PRIORITY_COLOR: Record<Task["priority"], string> = {
  urgent: "#ef4444", high: "#f97316", normal: "#94a3b8", low: "#64748b",
};

const STATUSES: { key: Task["status"]; label: string; color: string }[] = [
  { key: "todo", label: "To Do", color: "#94a3b8" },
  { key: "in_progress", label: "In Progress", color: "#3b82f6" },
  { key: "in_review", label: "In Review", color: "#f59e0b" },
  { key: "done", label: "Done", color: "#22c55e" },
];

export default function TaskDetailPanel() {
  const { selectedTaskId, setSelectedTask } = useWorkspaceStore();
  const { tasks, updateTask, deleteTask } = useTasksStore();
  const task = Object.values(tasks).flat().find((t) => t.id === selectedTaskId);

  const [editingTitle, setEditingTitle] = useState(false);
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [tagInput, setTagInput] = useState("");

  if (!task || !selectedTaskId) return null;

  const taskId = selectedTaskId;
  const status = STATUSES.find((s) => s.key === task.status);

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

  return (
    <div className="flex flex-col border-l overflow-y-auto flex-shrink-0"
      style={{ width: 380, background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>Task Detail</span>
        <div className="flex items-center gap-1">
          <button onClick={handleDelete} className="p-1 rounded hover:bg-red-500/10 transition-colors" style={{ color: "var(--danger)" }}>
            <Trash2 size={14} />
          </button>
          <button onClick={() => setSelectedTask(null)} className="p-1 rounded hover:bg-white/10 transition-colors" style={{ color: "var(--text-secondary)" }}>
            <X size={15} />
          </button>
        </div>
      </div>

      <div className="p-4 space-y-5 flex-1">
        {/* Title */}
        {editingTitle ? (
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)}
            onBlur={() => { updateTask(selectedTaskId, { title }); setEditingTitle(false); }}
            onKeyDown={(e) => { if (e.key === "Enter") { updateTask(selectedTaskId, { title }); setEditingTitle(false); } if (e.key === "Escape") setEditingTitle(false); }}
            className="w-full bg-transparent outline-none text-lg font-semibold border-b pb-1"
            style={{ color: "var(--text-primary)", borderColor: "var(--accent-purple)" }}
          />
        ) : (
          <h2 onClick={() => { setTitle(task.title); setEditingTitle(true); }}
            className="text-lg font-semibold cursor-text hover:opacity-80 transition-opacity"
            style={{ color: "var(--text-primary)" }}>
            {task.title}
          </h2>
        )}

        {/* Status + Priority */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs mb-1.5 font-medium uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>Status</p>
            <select value={task.status} onChange={(e) => updateTask(selectedTaskId, { status: e.target.value as Task["status"] })}
              className="w-full text-xs px-2 py-1.5 rounded-lg outline-none appearance-none cursor-pointer"
              style={{ background: `${status?.color}22`, color: status?.color, border: `1px solid ${status?.color}44` }}>
              {STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <p className="text-xs mb-1.5 font-medium uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>Priority</p>
            <select value={task.priority} onChange={(e) => updateTask(selectedTaskId, { priority: e.target.value as Task["priority"] })}
              className="w-full text-xs px-2 py-1.5 rounded-lg outline-none appearance-none cursor-pointer"
              style={{ background: `${PRIORITY_COLOR[task.priority]}22`, color: PRIORITY_COLOR[task.priority], border: `1px solid ${PRIORITY_COLOR[task.priority]}44` }}>
              {(["urgent","high","normal","low"] as Task["priority"][]).map((p) => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
            </select>
          </div>
        </div>

        {/* Due date */}
        <div>
          <p className="text-xs mb-1.5 font-medium uppercase tracking-wide flex items-center gap-1" style={{ color: "var(--text-secondary)" }}>
            <Calendar size={11} /> Due Date
          </p>
          <input type="date" value={task.due_date ?? ""}
            onChange={(e) => updateTask(selectedTaskId, { due_date: e.target.value })}
            className="text-xs px-2 py-1.5 rounded-lg outline-none"
            style={{ background: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
          />
        </div>

        {/* Description */}
        <div>
          <p className="text-xs mb-1.5 font-medium uppercase tracking-wide flex items-center gap-1" style={{ color: "var(--text-secondary)" }}>
            <AlignLeft size={11} /> Description
          </p>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)}
            onBlur={() => updateTask(selectedTaskId, { description })}
            placeholder="Add a description..."
            rows={4}
            className="w-full text-sm px-3 py-2 rounded-lg outline-none resize-none"
            style={{ background: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
          />
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
                <button onClick={() => updateTask(selectedTaskId, { tags: task.tags.filter((t) => t !== tag) })}
                  className="hover:text-white transition-colors ml-0.5">×</button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input value={tagInput} onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addTag()}
              placeholder="Add tag..."
              className="flex-1 text-xs px-2 py-1.5 rounded-lg outline-none"
              style={{ background: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
            />
            <button onClick={addTag} className="text-xs px-2 py-1.5 rounded-lg" style={{ background: "var(--accent-purple)", color: "white" }}>Add</button>
          </div>
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
