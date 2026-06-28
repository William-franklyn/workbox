"use client";
import { useEffect, useRef, useState } from "react";
import { useTasksStore } from "@/store/tasks";
import { useWorkspaceStore, Task } from "@/store/workspace";
import { useUIStore } from "@/store/ui";
import { useMembers, getMemberName, getMemberInitials } from "@/hooks/useMembers";
import { Plus, ChevronDown, ChevronRight, Flag, Lock, MessageCircle, CheckSquare } from "lucide-react";
import CreateTaskModal from "./CreateTaskModal";

const STATUSES: { key: Task["status"]; label: string; color: string }[] = [
  { key: "todo",        label: "To Do",       color: "#94a3b8" },
  { key: "in_progress", label: "In Progress", color: "#3b82f6" },
  { key: "in_review",   label: "In Review",   color: "#f59e0b" },
  { key: "done",        label: "Done",        color: "#22c55e" },
];

const PRIORITY_COLOR: Record<Task["priority"], string> = {
  urgent: "#ef4444", high: "#f97316", normal: "#94a3b8", low: "#64748b",
};

interface Counts { subtasks: number; comments: number; }

function AssigneeCell({ userId, members }: { userId?: string; members: ReturnType<typeof useMembers> }) {
  if (!userId) return <span style={{ color: "var(--text-secondary)" }}>—</span>;
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
        style={{ background: "var(--accent-purple)" }}>
        {getMemberInitials(members, userId)}
      </div>
      <span className="text-xs truncate" style={{ color: "var(--text-primary)" }}>
        {getMemberName(members, userId)}
      </span>
    </div>
  );
}

export default function TaskListView({ listId }: { listId: string }) {
  const { tasks, updateTask } = useTasksStore();
  const { selectedTaskId, setSelectedTask } = useWorkspaceStore();
  const userRole = useUIStore((s) => s.userRole);
  const members = useMembers();
  const listTasks = tasks[listId] || [];
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [modal, setModal] = useState<{ status: Task["status"] } | null>(null);
  const [counts, setCounts] = useState<Record<string, Counts>>({});
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!listId) return;
    fetch(`/api/tasks/counts?listId=${listId}`)
      .then((r) => r.json())
      .then((d) => { if (d && typeof d === "object") setCounts(d); })
      .catch(() => {});
  }, [listId, listTasks.length]);

  function startRename(task: Task) {
    setRenamingId(task.id);
    setRenameValue(task.title);
    setTimeout(() => renameRef.current?.select(), 20);
  }

  function commitRename(id: string) {
    if (renameValue.trim()) updateTask(id, { title: renameValue.trim() });
    setRenamingId(null);
  }

  return (
    <>
    <div className="h-full overflow-y-auto" style={{ background: "var(--bg-primary)" }}>

      {/* Sticky column headers */}
      <div className="sticky top-0 z-10 flex items-center border-b px-4 py-2"
        style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
        <div className="flex-1 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>Name</div>
        <div className="w-36 text-xs font-semibold uppercase tracking-wider hidden md:block" style={{ color: "var(--text-secondary)" }}>Assignee</div>
        <div className="w-28 text-xs font-semibold uppercase tracking-wider hidden sm:block" style={{ color: "var(--text-secondary)" }}>Due Date</div>
        <div className="w-24 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>Priority</div>
        <div className="w-8" />
      </div>

      {STATUSES.map(({ key, label, color }) => {
        const group = listTasks.filter((t) => t.status === key);
        const isCollapsed = collapsed[key];

        return (
          <div key={key}>
            {/* Status group header */}
            <button
              onClick={() => setCollapsed((c) => ({ ...c, [key]: !c[key] }))}
              className="w-full flex items-center gap-2 px-4 py-2 hover:bg-white/3 transition-colors"
              style={{ borderBottom: "1px solid var(--border)" }}>
              {isCollapsed
                ? <ChevronRight size={12} style={{ color: "var(--text-secondary)" }} />
                : <ChevronDown size={12} style={{ color: "var(--text-secondary)" }} />}
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
              <span className="text-xs font-semibold uppercase tracking-wide" style={{ color }}>{label}</span>
              <span className="text-xs px-1.5 py-0.5 rounded-full ml-1"
                style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-secondary)" }}>
                {group.length}
              </span>
            </button>

            {!isCollapsed && (
              <>
                {group.map((task) => {
                  const taskCounts = counts[task.id];
                  const isDone = task.status === "done";

                  return (
                    <div key={task.id}
                      onClick={() => { if (renamingId !== task.id) setSelectedTask(task.id); }}
                      className="group flex items-center px-4 py-2.5 border-b cursor-pointer hover:bg-white/3 transition-colors"
                      style={{
                        borderColor: "var(--border)",
                        background: selectedTaskId === task.id ? "rgba(124,58,237,0.07)" : "transparent",
                      }}>

                      {/* Name column */}
                      <div className="flex-1 flex items-center gap-2.5 min-w-0 pr-3">
                        <div className="w-3.5 h-3.5 rounded-full border-2 shrink-0"
                          style={{ borderColor: color, background: isDone ? color : "transparent" }} />

                        {renamingId === task.id ? (
                          <input
                            ref={renameRef}
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onBlur={() => commitRename(task.id)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") commitRename(task.id);
                              if (e.key === "Escape") setRenamingId(null);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="flex-1 bg-transparent outline-none text-sm border-b"
                            style={{ color: "var(--text-primary)", borderColor: "var(--accent-purple)" }}
                          />
                        ) : (
                          <span
                            className="text-sm truncate"
                            style={{ color: "var(--text-primary)", opacity: isDone ? 0.5 : 1, textDecoration: isDone ? "line-through" : "none" }}
                            onDoubleClick={(e) => { e.stopPropagation(); startRename(task); }}
                          >
                            {task.title}
                          </span>
                        )}

                        {task.locked && <Lock size={9} style={{ color: "var(--text-secondary)", flexShrink: 0 }} />}

                        {/* Badges */}
                        <div className="flex items-center gap-1.5 ml-1 shrink-0">
                          {task.tags.slice(0, 1).map((tag) => (
                            <span key={tag} className="text-xs px-1.5 py-0.5 rounded-full hidden lg:inline"
                              style={{ background: "rgba(255,255,255,0.07)", color: "var(--text-secondary)" }}>{tag}</span>
                          ))}
                          {taskCounts?.subtasks > 0 && (
                            <span className="flex items-center gap-0.5 text-xs opacity-60 group-hover:opacity-100 transition-opacity"
                              style={{ color: "var(--text-secondary)" }}>
                              <CheckSquare size={10} /> {taskCounts.subtasks}
                            </span>
                          )}
                          {taskCounts?.comments > 0 && (
                            <span className="flex items-center gap-0.5 text-xs opacity-60 group-hover:opacity-100 transition-opacity"
                              style={{ color: "var(--text-secondary)" }}>
                              <MessageCircle size={10} /> {taskCounts.comments}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Assignee */}
                      <div className="w-36 pr-2 hidden md:block">
                        <AssigneeCell userId={task.assignee} members={members} />
                      </div>

                      {/* Due date */}
                      <div className="w-28 pr-2 hidden sm:block">
                        {task.due_date ? (
                          <span className="text-xs" style={{
                            color: !isDone && new Date(task.due_date) < new Date()
                              ? "#ef4444" : "var(--text-secondary)"
                          }}>
                            {new Date(task.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </span>
                        ) : (
                          <span className="text-xs" style={{ color: "var(--text-secondary)" }}>—</span>
                        )}
                      </div>

                      {/* Priority */}
                      <div className="w-24 pr-2">
                        <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full"
                          style={{ background: `${PRIORITY_COLOR[task.priority]}18`, color: PRIORITY_COLOR[task.priority] }}>
                          <Flag size={9} />
                          {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                        </span>
                      </div>

                      <div className="w-8" />
                    </div>
                  );
                })}

                {/* Add task row */}
                {userRole === "admin" && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setModal({ status: key }); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2 border-b hover:bg-white/3 transition-colors"
                    style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
                    <Plus size={12} />
                    <span className="text-xs">Add task</span>
                  </button>
                )}
              </>
            )}
          </div>
        );
      })}

      {listTasks.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: "rgba(124,58,237,0.1)" }}>
            <CheckSquare size={22} style={{ color: "var(--accent-purple)" }} />
          </div>
          <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>No tasks yet</p>
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            {userRole === "admin" ? 'Click "Add Task" above to get started.' : "Tasks will appear here once the admin creates them."}
          </p>
        </div>
      )}
    </div>
    {modal && <CreateTaskModal listId={listId} initialStatus={modal.status} onClose={() => setModal(null)} />}
    </>
  );
}
