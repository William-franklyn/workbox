"use client";
import { useState } from "react";
import { useTasksStore } from "@/store/tasks";
import { useWorkspaceStore, Task } from "@/store/workspace";
import { ChevronUp, ChevronDown, Plus } from "lucide-react";
import { useUIStore } from "@/store/ui";
import CreateTaskModal from "./CreateTaskModal";

type SortKey = "title" | "status" | "priority" | "due_date";

const PRIORITY_ORDER: Record<Task["priority"], number> = { urgent: 0, high: 1, normal: 2, low: 3 };
const STATUS_ORDER: Record<Task["status"], number> = { todo: 0, in_progress: 1, in_review: 2, done: 3 };
const STATUS_COLOR: Record<Task["status"], string> = { todo: "#94a3b8", in_progress: "#3b82f6", in_review: "#f59e0b", done: "#22c55e" };
const PRIORITY_COLOR: Record<Task["priority"], string> = { urgent: "#ef4444", high: "#f97316", normal: "#94a3b8", low: "#64748b" };

export default function TableView({ listId }: { listId: string }) {
  const { tasks, updateTask } = useTasksStore();
  const { setSelectedTask } = useWorkspaceStore();
  const userRole = useUIStore((s) => s.userRole);
  const listTasks = tasks[listId] || [];

  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "title", dir: "asc" });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editingCell, setEditingCell] = useState<{ id: string; key: string } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [showModal, setShowModal] = useState(false);

  const sorted = [...listTasks].sort((a, b) => {
    let cmp = 0;
    if (sort.key === "priority") cmp = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    else if (sort.key === "status") cmp = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    else if (sort.key === "due_date") cmp = (a.due_date ?? "").localeCompare(b.due_date ?? "");
    else cmp = a.title.localeCompare(b.title);
    return sort.dir === "asc" ? cmp : -cmp;
  });

  function toggleSort(key: SortKey) {
    setSort((s) => s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" });
  }

  function startEdit(id: string, key: string, value: string) {
    setEditingCell({ id, key });
    setEditValue(value);
  }

  function commitEdit() {
    if (!editingCell) return;
    updateTask(editingCell.id, { [editingCell.key]: editValue } as any);
    setEditingCell(null);
  }

  function toggleSelect(id: string) {
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  const columns: { key: SortKey; label: string; width: string }[] = [
    { key: "title", label: "Task name", width: "1fr" },
    { key: "status", label: "Status", width: "130px" },
    { key: "priority", label: "Priority", width: "110px" },
    { key: "due_date", label: "Due date", width: "120px" },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Bulk actions bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 px-6 py-2 border-b" style={{ background: "rgba(124,58,237,0.1)", borderColor: "var(--accent-purple)" }}>
          <span className="text-xs font-medium" style={{ color: "var(--accent-purple)" }}>{selected.size} selected</span>
          <button onClick={() => { selected.forEach((id) => updateTask(id, { status: "done" })); setSelected(new Set()); }}
            className="text-xs px-2 py-1 rounded-md hover:bg-white/10 transition-colors" style={{ color: "var(--text-secondary)" }}>
            Mark done
          </button>
          <button onClick={() => setSelected(new Set())}
            className="text-xs px-2 py-1 rounded-md hover:bg-white/10 transition-colors" style={{ color: "var(--text-secondary)" }}>
            Clear
          </button>
        </div>
      )}

      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse">
          {/* Header */}
          <thead>
            <tr style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)" }}>
              <th className="w-10 px-3 py-3">
                <input type="checkbox"
                  checked={selected.size === listTasks.length && listTasks.length > 0}
                  onChange={(e) => setSelected(e.target.checked ? new Set(listTasks.map((t) => t.id)) : new Set())}
                  className="accent-purple-600"
                />
              </th>
              {columns.map(({ key, label }) => (
                <th key={key} className="text-left px-3 py-3 cursor-pointer select-none"
                  onClick={() => toggleSort(key)}
                  style={{ color: "var(--text-secondary)" }}>
                  <div className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide">
                    {label}
                    {sort.key === key ? (sort.dir === "asc" ? <ChevronUp size={11} /> : <ChevronDown size={11} />) : null}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((task) => (
              <tr key={task.id}
                className="border-b hover:bg-white/2 transition-colors group"
                style={{ borderColor: "var(--border)", background: selected.has(task.id) ? "rgba(124,58,237,0.06)" : "transparent" }}
              >
                <td className="px-3 py-2.5">
                  <input type="checkbox" checked={selected.has(task.id)} onChange={() => toggleSelect(task.id)} />
                </td>
                {/* Title — frozen first col */}
                <td className="px-3 py-2.5 font-medium text-sm cursor-pointer" style={{ color: "var(--text-primary)" }}
                  onClick={() => setSelectedTask(task.id)}>
                  {editingCell?.id === task.id && editingCell.key === "title" ? (
                    <input autoFocus value={editValue} onChange={(e) => setEditValue(e.target.value)}
                      onBlur={commitEdit} onKeyDown={(e) => e.key === "Enter" && commitEdit()}
                      className="w-full bg-transparent outline-none border-b text-sm"
                      style={{ color: "var(--text-primary)", borderColor: "var(--accent-purple)" }}
                    />
                  ) : (
                    <span onDoubleClick={() => startEdit(task.id, "title", task.title)}
                      style={{ textDecoration: task.status === "done" ? "line-through" : "none", opacity: task.status === "done" ? 0.5 : 1 }}>
                      {task.title}
                    </span>
                  )}
                </td>
                {/* Status */}
                <td className="px-3 py-2.5">
                  <select value={task.status}
                    onChange={(e) => updateTask(task.id, { status: e.target.value as Task["status"] })}
                    className="text-xs px-2 py-1 rounded-full appearance-none outline-none cursor-pointer"
                    style={{ background: `${STATUS_COLOR[task.status]}22`, color: STATUS_COLOR[task.status], border: `1px solid ${STATUS_COLOR[task.status]}44` }}>
                    {(["todo","in_progress","in_review","done"] as Task["status"][]).map((s) => (
                      <option key={s} value={s}>{s.replace("_", " ")}</option>
                    ))}
                  </select>
                </td>
                {/* Priority */}
                <td className="px-3 py-2.5">
                  <select value={task.priority}
                    onChange={(e) => updateTask(task.id, { priority: e.target.value as Task["priority"] })}
                    className="text-xs px-2 py-1 rounded-full appearance-none outline-none cursor-pointer capitalize"
                    style={{ background: `${PRIORITY_COLOR[task.priority]}22`, color: PRIORITY_COLOR[task.priority], border: `1px solid ${PRIORITY_COLOR[task.priority]}44` }}>
                    {(["urgent","high","normal","low"] as Task["priority"][]).map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </td>
                {/* Due date */}
                <td className="px-3 py-2.5">
                  <input type="date" value={task.due_date ?? ""}
                    onChange={(e) => updateTask(task.id, { due_date: e.target.value })}
                    className="text-xs bg-transparent outline-none cursor-pointer"
                    style={{ color: task.due_date ? "var(--text-primary)" : "var(--text-secondary)" }}
                  />
                </td>
              </tr>
            ))}

            {userRole === "admin" && (
              <tr>
                <td colSpan={5} className="px-3 py-2">
                  <button onClick={() => setShowModal(true)}
                    className="flex items-center gap-2 text-xs hover:opacity-80 transition-opacity"
                    style={{ color: "var(--text-secondary)" }}>
                    <Plus size={12} /> Add task
                  </button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="px-6 py-2 border-t text-xs" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
        {listTasks.length} tasks · Double-click to edit title
      </div>
    </div>
    {showModal && <CreateTaskModal listId={listId} onClose={() => setShowModal(false)} />}
  );
}
