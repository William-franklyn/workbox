"use client";
import { useState } from "react";
import { useTasksStore } from "@/store/tasks";
import { useWorkspaceStore, Task } from "@/store/workspace";
import { useUIStore } from "@/store/ui";
import { Plus, ChevronDown, ChevronRight, Flag, Circle } from "lucide-react";
import TaskDetailPanel from "./TaskDetailPanel";

const STATUSES: { key: Task["status"]; label: string; color: string }[] = [
  { key: "todo", label: "To Do", color: "#94a3b8" },
  { key: "in_progress", label: "In Progress", color: "#3b82f6" },
  { key: "in_review", label: "In Review", color: "#f59e0b" },
  { key: "done", label: "Done", color: "#22c55e" },
];

const PRIORITY_COLOR: Record<Task["priority"], string> = {
  urgent: "#ef4444", high: "#f97316", normal: "#94a3b8", low: "#64748b",
};

const PRIORITY_LABEL: Record<Task["priority"], string> = {
  urgent: "Urgent", high: "High", normal: "Normal", low: "Low",
};

export default function TaskListView({ listId }: { listId: string }) {
  const { tasks, addTask, updateTask } = useTasksStore();
  const { selectedTaskId, setSelectedTask } = useWorkspaceStore();
  const listTasks = tasks[listId] || [];
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [adding, setAdding] = useState<Task["status"] | null>(null);
  const [newTitle, setNewTitle] = useState("");

  function handleAddTask(status: Task["status"]) {
    if (!newTitle.trim()) { setAdding(null); return; }
    addTask({
      id: `t${Date.now()}`, title: newTitle.trim(), status,
      priority: "normal", list_id: listId, position: listTasks.length,
      tags: [], created_at: new Date().toISOString(),
    });
    setNewTitle("");
    setAdding(null);
  }

  return (
    <div className="flex h-full">
      <div className="flex-1 overflow-y-auto p-6">
        {STATUSES.map(({ key, label, color }) => {
          const group = listTasks.filter((t) => t.status === key);
          const isCollapsed = collapsed[key];
          return (
            <div key={key} className="mb-6">
              {/* Group header */}
              <div className="flex items-center gap-2 mb-2 group">
                <button onClick={() => setCollapsed((c) => ({ ...c, [key]: !c[key] }))}
                  className="flex items-center gap-2 text-sm font-semibold hover:opacity-80 transition-opacity"
                  style={{ color }}
                >
                  {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                  <span className="w-2 h-2 rounded-full" style={{ background: color }} />
                  {label}
                  <span className="text-xs font-normal ml-1 px-1.5 rounded-full" style={{ background: "var(--bg-surface)", color: "var(--text-secondary)" }}>
                    {group.length}
                  </span>
                </button>
              </div>

              {!isCollapsed && (
                <div className="rounded-lg overflow-hidden border" style={{ borderColor: "var(--border)" }}>
                  {/* Column headers */}
                  <div className="grid text-xs font-semibold uppercase tracking-wide px-4 py-2 border-b"
                    style={{ gridTemplateColumns: "1fr 100px 100px 100px", borderColor: "var(--border)", background: "var(--bg-secondary)", color: "var(--text-secondary)" }}>
                    <span>Task</span><span>Priority</span><span>Due Date</span><span>Status</span>
                  </div>

                  {group.map((task) => (
                    <div key={task.id}
                      onClick={() => setSelectedTask(task.id)}
                      className="grid items-center px-4 py-2.5 border-b cursor-pointer hover:bg-white/3 transition-colors"
                      style={{ gridTemplateColumns: "1fr 100px 100px 100px", borderColor: "var(--border)", background: selectedTaskId === task.id ? "rgba(124,58,237,0.08)" : "var(--bg-secondary)" }}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Circle size={14} style={{ color, flexShrink: 0 }} />
                        <span className="text-sm truncate" style={{ color: "var(--text-primary)", textDecoration: task.status === "done" ? "line-through" : "none", opacity: task.status === "done" ? 0.5 : 1 }}>
                          {task.title}
                        </span>
                        {task.tags.map((tag) => (
                          <span key={tag} className="text-xs px-1.5 py-0.5 rounded-full shrink-0"
                            style={{ background: "var(--bg-surface)", color: "var(--text-secondary)" }}>{tag}</span>
                        ))}
                      </div>
                      <div className="flex items-center gap-1">
                        <Flag size={12} style={{ color: PRIORITY_COLOR[task.priority] }} />
                        <span className="text-xs" style={{ color: PRIORITY_COLOR[task.priority] }}>{PRIORITY_LABEL[task.priority]}</span>
                      </div>
                      <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                        {task.due_date ? new Date(task.due_date).toLocaleDateString() : "—"}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full w-fit" style={{ background: `${color}22`, color }}>
                        {label}
                      </span>
                    </div>
                  ))}

                  {/* Inline add */}
                  {adding === key ? (
                    <div className="px-4 py-2.5 flex items-center gap-2" style={{ background: "var(--bg-secondary)" }}>
                      <Circle size={14} style={{ color, flexShrink: 0 }} />
                      <input
                        autoFocus value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") handleAddTask(key); if (e.key === "Escape") setAdding(null); }}
                        onBlur={() => handleAddTask(key)}
                        placeholder="Task name..."
                        className="flex-1 bg-transparent outline-none text-sm"
                        style={{ color: "var(--text-primary)" }}
                      />
                    </div>
                  ) : (
                    <button
                      onClick={() => { setAdding(key); setNewTitle(""); }}
                      className="flex items-center gap-2 px-4 py-2 text-xs hover:bg-white/3 w-full transition-colors"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      <Plus size={12} /> Add task
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Task detail panel */}
      {selectedTaskId && (
        <TaskDetailPanel
          taskId={selectedTaskId}
          onClose={() => setSelectedTask(null)}
        />
      )}
    </div>
  );
}
