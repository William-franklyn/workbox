"use client";
import { useState } from "react";
import { useTasksStore } from "@/store/tasks";
import { Task } from "@/store/workspace";
import { X, Flag, Calendar, Tag, AlignLeft, CheckSquare } from "lucide-react";

const PRIORITY_COLOR: Record<Task["priority"], string> = {
  urgent: "#ef4444", high: "#f97316", normal: "#94a3b8", low: "#64748b",
};

const STATUSES: { key: Task["status"]; label: string; color: string }[] = [
  { key: "todo", label: "To Do", color: "#94a3b8" },
  { key: "in_progress", label: "In Progress", color: "#3b82f6" },
  { key: "in_review", label: "In Review", color: "#f59e0b" },
  { key: "done", label: "Done", color: "#22c55e" },
];

export default function TaskDetailPanel({ taskId, onClose }: { taskId: string; onClose: () => void }) {
  const { tasks, updateTask } = useTasksStore();
  const task = Object.values(tasks).flat().find((t) => t.id === taskId);
  const [editingTitle, setEditingTitle] = useState(false);
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");

  if (!task) return null;

  const status = STATUSES.find((s) => s.key === task.status);

  return (
    <div
      className="flex flex-col border-l overflow-y-auto"
      style={{ width: 380, background: "var(--bg-secondary)", borderColor: "var(--border)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>Task Detail</span>
        <button onClick={onClose} className="p-1 rounded hover:bg-white/10 transition-colors" style={{ color: "var(--text-secondary)" }}>
          <X size={15} />
        </button>
      </div>

      <div className="p-4 space-y-5 flex-1">
        {/* Title */}
        {editingTitle ? (
          <input
            autoFocus value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => { updateTask(taskId, { title }); setEditingTitle(false); }}
            onKeyDown={(e) => { if (e.key === "Enter") { updateTask(taskId, { title }); setEditingTitle(false); } }}
            className="w-full bg-transparent outline-none text-lg font-semibold border-b pb-1"
            style={{ color: "var(--text-primary)", borderColor: "var(--accent-purple)" }}
          />
        ) : (
          <h2 onClick={() => setEditingTitle(true)}
            className="text-lg font-semibold cursor-text hover:opacity-80 transition-opacity"
            style={{ color: "var(--text-primary)" }}>
            {task.title}
          </h2>
        )}

        {/* Status + Priority */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs mb-1.5 font-medium uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>Status</p>
            <select
              value={task.status}
              onChange={(e) => updateTask(taskId, { status: e.target.value as Task["status"] })}
              className="w-full text-xs px-2 py-1.5 rounded-lg outline-none appearance-none"
              style={{ background: `${status?.color}22`, color: status?.color, border: `1px solid ${status?.color}44` }}
            >
              {STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <p className="text-xs mb-1.5 font-medium uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>Priority</p>
            <select
              value={task.priority}
              onChange={(e) => updateTask(taskId, { priority: e.target.value as Task["priority"] })}
              className="w-full text-xs px-2 py-1.5 rounded-lg outline-none appearance-none"
              style={{ background: `${PRIORITY_COLOR[task.priority]}22`, color: PRIORITY_COLOR[task.priority], border: `1px solid ${PRIORITY_COLOR[task.priority]}44` }}
            >
              {["urgent", "high", "normal", "low"].map((p) => <option key={p} value={p} style={{ color: PRIORITY_COLOR[p as Task["priority"]] }}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
            </select>
          </div>
        </div>

        {/* Due date */}
        <div>
          <p className="text-xs mb-1.5 font-medium uppercase tracking-wide flex items-center gap-1" style={{ color: "var(--text-secondary)" }}>
            <Calendar size={11} /> Due Date
          </p>
          <input
            type="date" value={task.due_date ?? ""}
            onChange={(e) => updateTask(taskId, { due_date: e.target.value })}
            className="text-xs px-2 py-1.5 rounded-lg outline-none"
            style={{ background: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
          />
        </div>

        {/* Description */}
        <div>
          <p className="text-xs mb-1.5 font-medium uppercase tracking-wide flex items-center gap-1" style={{ color: "var(--text-secondary)" }}>
            <AlignLeft size={11} /> Description
          </p>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={() => updateTask(taskId, { description })}
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
          <div className="flex flex-wrap gap-1.5">
            {task.tags.map((tag) => (
              <span key={tag} className="text-xs px-2 py-0.5 rounded-full flex items-center gap-1"
                style={{ background: "var(--bg-surface)", color: "var(--text-secondary)" }}>
                {tag}
                <button onClick={() => updateTask(taskId, { tags: task.tags.filter((t) => t !== tag) })}
                  className="hover:text-white transition-colors">×</button>
              </span>
            ))}
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
