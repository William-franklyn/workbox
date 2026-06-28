"use client";
import { useState } from "react";
import { useTasksStore } from "@/store/tasks";
import { useWorkspaceStore, Task } from "@/store/workspace";
import { useUIStore } from "@/store/ui";
import { useMembers, getMemberName, getMemberInitials } from "@/hooks/useMembers";
import { Plus, ChevronDown, ChevronRight, Flag, Lock } from "lucide-react";
import CreateTaskModal from "./CreateTaskModal";

const STATUSES: { key: Task["status"]; label: string; color: string }[] = [
  { key: "todo",      label: "To Do",       color: "#94a3b8" },
  { key: "in_progress", label: "In Progress", color: "#3b82f6" },
  { key: "in_review", label: "In Review",   color: "#f59e0b" },
  { key: "done",      label: "Done",        color: "#22c55e" },
];

const PRIORITY_COLOR: Record<Task["priority"], string> = {
  urgent: "#ef4444", high: "#f97316", normal: "#94a3b8", low: "#64748b",
};

function AssigneeCell({ userId, members }: { userId?: string; members: ReturnType<typeof useMembers> }) {
  if (!userId) return <span style={{ color: "var(--text-secondary)" }}>—</span>;
  const initials = getMemberInitials(members, userId);
  const name = getMemberName(members, userId);
  return (
    <div className="flex items-center gap-2">
      <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
        style={{ background: "var(--accent-purple)" }}>
        {initials}
      </div>
      <span className="text-xs truncate" style={{ color: "var(--text-primary)" }}>{name}</span>
    </div>
  );
}

export default function TaskListView({ listId }: { listId: string }) {
  const { tasks } = useTasksStore();
  const { selectedTaskId, setSelectedTask } = useWorkspaceStore();
  const userRole = useUIStore((s) => s.userRole);
  const members = useMembers();
  const listTasks = tasks[listId] || [];
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [modal, setModal] = useState<{ status: Task["status"] } | null>(null);

  return (
    <>
    <div className="flex-1 overflow-y-auto h-full" style={{ background: "var(--bg-primary)" }}>

      {/* Sticky column header */}
      <div className="sticky top-0 z-10 flex items-center border-b px-4 py-2"
        style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
        <div className="flex-1 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>Name</div>
        <div className="w-36 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>Assignee</div>
        <div className="w-28 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>Due Date</div>
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
              style={{ borderBottom: `1px solid var(--border)` }}>
              {isCollapsed
                ? <ChevronRight size={13} style={{ color: "var(--text-secondary)" }} />
                : <ChevronDown size={13} style={{ color: "var(--text-secondary)" }} />}
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
              <span className="text-xs font-semibold uppercase tracking-wide" style={{ color }}>{label}</span>
              <span className="text-xs px-1.5 py-0.5 rounded-full ml-1"
                style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-secondary)" }}>
                {group.length}
              </span>
            </button>

            {!isCollapsed && (
              <>
                {group.map((task) => (
                  <div key={task.id}
                    onClick={() => setSelectedTask(task.id)}
                    className="flex items-center px-4 py-2.5 border-b cursor-pointer hover:bg-white/3 transition-colors"
                    style={{
                      borderColor: "var(--border)",
                      background: selectedTaskId === task.id ? "rgba(124,58,237,0.07)" : "transparent",
                    }}>

                    {/* Name */}
                    <div className="flex-1 flex items-center gap-2.5 min-w-0 pr-3">
                      <div className="w-3.5 h-3.5 rounded-full border-2 shrink-0 transition-colors"
                        style={{ borderColor: task.status === "done" ? color : color + "88" ,
                          background: task.status === "done" ? color : "transparent" }} />
                      <span className="text-sm truncate"
                        style={{ color: "var(--text-primary)", opacity: task.status === "done" ? 0.5 : 1,
                          textDecoration: task.status === "done" ? "line-through" : "none" }}>
                        {task.title}
                      </span>
                      {task.locked && <Lock size={10} style={{ color: "var(--text-secondary)", flexShrink: 0 }} />}
                      {task.tags.slice(0, 2).map((tag) => (
                        <span key={tag} className="text-xs px-1.5 py-0.5 rounded-full shrink-0 hidden sm:inline"
                          style={{ background: "rgba(255,255,255,0.07)", color: "var(--text-secondary)" }}>{tag}</span>
                      ))}
                    </div>

                    {/* Assignee */}
                    <div className="w-36 pr-2">
                      <AssigneeCell userId={task.assignee} members={members} />
                    </div>

                    {/* Due date */}
                    <div className="w-28 pr-2">
                      {task.due_date ? (
                        <span className="text-xs" style={{
                          color: new Date(task.due_date) < new Date() && task.status !== "done"
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
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
                        style={{ background: `${PRIORITY_COLOR[task.priority]}18`, color: PRIORITY_COLOR[task.priority] }}>
                        <Flag size={9} />
                        {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                      </span>
                    </div>

                    <div className="w-8" />
                  </div>
                ))}

                {/* Add task row */}
                {userRole === "admin" && (
                  <button onClick={(e) => { e.stopPropagation(); setModal({ status: key }); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2 border-b hover:bg-white/3 transition-colors"
                    style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
                    <Plus size={13} />
                    <span className="text-xs">Add task</span>
                  </button>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
    {modal && <CreateTaskModal listId={listId} initialStatus={modal.status} onClose={() => setModal(null)} />}
    </>
  );
}
