"use client";
import { useState } from "react";
import { useTasksStore } from "@/store/tasks";
import { useWorkspaceStore, Task } from "@/store/workspace";
import { Flag, Plus, MoreHorizontal } from "lucide-react";

const STATUSES: { key: Task["status"]; label: string; color: string }[] = [
  { key: "todo", label: "To Do", color: "#94a3b8" },
  { key: "in_progress", label: "In Progress", color: "#3b82f6" },
  { key: "in_review", label: "In Review", color: "#f59e0b" },
  { key: "done", label: "Done", color: "#22c55e" },
];

const PRIORITY_COLOR: Record<Task["priority"], string> = {
  urgent: "#ef4444", high: "#f97316", normal: "#94a3b8", low: "#64748b",
};

export default function KanbanBoard({ listId }: { listId: string }) {
  const { tasks, addTask, moveTask } = useTasksStore();
  const { selectedTaskId, setSelectedTask } = useWorkspaceStore();
  const listTasks = tasks[listId] || [];
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<Task["status"] | null>(null);
  const [adding, setAdding] = useState<Task["status"] | null>(null);
  const [newTitle, setNewTitle] = useState("");

  function handleDrop(status: Task["status"]) {
    if (dragging) { moveTask(dragging, status); setDragging(null); setDragOver(null); }
  }

  function handleAddTask(status: Task["status"]) {
    if (!newTitle.trim()) { setAdding(null); return; }
    addTask({ id: `t${Date.now()}`, title: newTitle.trim(), status, priority: "normal", list_id: listId, position: listTasks.length, tags: [], created_at: new Date().toISOString() });
    setNewTitle(""); setAdding(null);
  }

  return (
    <div className="flex gap-4 p-6 overflow-x-auto h-full">
      {STATUSES.map(({ key, label, color }) => {
        const group = listTasks.filter((t) => t.status === key);
        const isOver = dragOver === key;
        return (
          <div key={key}
            className="flex flex-col rounded-xl shrink-0 transition-colors"
            style={{ width: 280, background: isOver ? "rgba(124,58,237,0.08)" : "var(--bg-secondary)", border: `1px solid ${isOver ? "var(--accent-purple)" : "var(--border)"}` }}
            onDragOver={(e) => { e.preventDefault(); setDragOver(key); }}
            onDragLeave={() => setDragOver(null)}
            onDrop={() => handleDrop(key)}
          >
            {/* Column header */}
            <div className="flex items-center justify-between px-3 py-3 border-b" style={{ borderColor: "var(--border)" }}>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ background: color }} />
                <span className="text-sm font-semibold" style={{ color }}>{label}</span>
                <span className="text-xs px-1.5 rounded-full" style={{ background: "var(--bg-primary)", color: "var(--text-secondary)" }}>{group.length}</span>
              </div>
              <button className="p-1 rounded hover:bg-white/10 transition-colors" style={{ color: "var(--text-secondary)" }}>
                <MoreHorizontal size={14} />
              </button>
            </div>

            {/* Cards */}
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {group.map((task) => (
                <div key={task.id}
                  draggable
                  onDragStart={() => setDragging(task.id)}
                  onDragEnd={() => { setDragging(null); setDragOver(null); }}
                  onClick={() => setSelectedTask(task.id)}
                  className="rounded-lg p-3 cursor-pointer transition-all hover:translate-y-[-1px] hover:shadow-lg"
                  style={{
                    background: selectedTaskId === task.id ? "rgba(124,58,237,0.15)" : "var(--bg-primary)",
                    border: `1px solid ${selectedTaskId === task.id ? "var(--accent-purple)" : "var(--border)"}`,
                    opacity: dragging === task.id ? 0.5 : 1,
                  }}
                >
                  {task.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {task.tags.map((tag) => (
                        <span key={tag} className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: "var(--bg-surface)", color: "var(--text-secondary)" }}>{tag}</span>
                      ))}
                    </div>
                  )}
                  <p className="text-sm mb-2" style={{ color: "var(--text-primary)", textDecoration: task.status === "done" ? "line-through" : "none", opacity: task.status === "done" ? 0.6 : 1 }}>
                    {task.title}
                  </p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <Flag size={11} style={{ color: PRIORITY_COLOR[task.priority] }} />
                      <span className="text-xs capitalize" style={{ color: PRIORITY_COLOR[task.priority] }}>{task.priority}</span>
                    </div>
                    {task.due_date && (
                      <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                        {new Date(task.due_date).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              ))}

              {/* Inline add */}
              {adding === key ? (
                <div className="rounded-lg p-3" style={{ background: "var(--bg-primary)", border: "1px solid var(--accent-purple)" }}>
                  <input autoFocus value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleAddTask(key); if (e.key === "Escape") setAdding(null); }}
                    onBlur={() => handleAddTask(key)}
                    placeholder="Task name..."
                    className="w-full bg-transparent outline-none text-sm"
                    style={{ color: "var(--text-primary)" }}
                  />
                </div>
              ) : (
                <button onClick={() => { setAdding(key); setNewTitle(""); }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs hover:bg-white/5 transition-colors"
                  style={{ color: "var(--text-secondary)" }}
                >
                  <Plus size={12} /> Add task
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
