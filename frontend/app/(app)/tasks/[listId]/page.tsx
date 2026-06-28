"use client";
import { use, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useWorkspaceStore } from "@/store/workspace";
import { useTasksStore } from "@/store/tasks";
import { useUIStore } from "@/store/ui";
import { useRealtimeTasks } from "@/hooks/useRealtimeTasks";
import TaskListView from "@/components/tasks/TaskListView";
import KanbanBoard from "@/components/tasks/KanbanBoard";
import CalendarView from "@/components/tasks/CalendarView";
import TableView from "@/components/tasks/TableView";
import TaskDetailPanel from "@/components/tasks/TaskDetailPanel";
import GanttView from "@/components/tasks/GanttView";
import CreateTaskModal from "@/components/tasks/CreateTaskModal";
import { Loader2, LayoutList, Kanban, Calendar, Table, GanttChart, Plus, ChevronDown, Users, SlidersHorizontal } from "lucide-react";

type View = "list" | "board" | "calendar" | "table" | "gantt";

const VIEWS: { key: View; icon: React.ReactNode; label: string }[] = [
  { key: "list",     icon: <LayoutList size={14} />,  label: "List" },
  { key: "board",    icon: <Kanban size={14} />,       label: "Board" },
  { key: "calendar", icon: <Calendar size={14} />,     label: "Calendar" },
  { key: "table",    icon: <Table size={14} />,        label: "Table" },
  { key: "gantt",    icon: <GanttChart size={14} />,   label: "Gantt" },
];

export default function TasksPage({ params }: { params: Promise<{ listId: string }> }) {
  const { listId } = use(params);
  const searchParams = useSearchParams();
  const { view, setView, selectedTaskId } = useWorkspaceStore();
  const { reloadTasks, loadedLists } = useTasksStore();
  const userRole = useUIStore((s) => s.userRole);
  const isLoaded = loadedLists.has(listId);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => { reloadTasks(listId); }, [listId]);
  useRealtimeTasks(listId);

  // Switch to calendar view if navigated here with ?view=calendar
  useEffect(() => {
    if (searchParams.get("view") === "calendar") setView("calendar");
  }, [searchParams, setView]);

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 size={20} className="animate-spin" style={{ color: "var(--text-secondary)" }} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* View tab bar — like ClickUp */}
      <div className="border-b shrink-0" style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}>
        <div className="flex items-center px-4">
          {VIEWS.map(({ key, icon, label }) => (
            <button key={key} onClick={() => setView(key)}
              className="flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition-colors"
              style={{
                borderColor: view === key ? "var(--accent-purple)" : "transparent",
                color: view === key ? "var(--accent-purple)" : "var(--text-secondary)",
              }}>
              {icon} {label}
            </button>
          ))}
          <button className="flex items-center gap-1 px-3 py-2.5 text-xs transition-colors" style={{ color: "var(--text-secondary)" }}>
            <Plus size={11} /> View
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b shrink-0" style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}>
        <button className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs border hover:bg-white/5 transition-colors"
          style={{ color: "var(--text-secondary)", borderColor: "var(--border)" }}>
          <SlidersHorizontal size={11} /> Group: Status <ChevronDown size={10} />
        </button>
        <button className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs border hover:bg-white/5 transition-colors"
          style={{ color: "var(--text-secondary)", borderColor: "var(--border)" }}>
          <Users size={11} /> Assignee <ChevronDown size={10} />
        </button>
        <div className="flex-1" />
        {userRole === "admin" && (
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white hover:opacity-90 transition-opacity"
            style={{ background: "var(--accent-purple)" }}>
            <Plus size={13} /> Add Task
          </button>
        )}
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-hidden">
          {view === "list"     && <TaskListView listId={listId} />}
          {view === "board"    && <KanbanBoard listId={listId} />}
          {view === "calendar" && <CalendarView listId={listId} />}
          {view === "table"    && <TableView listId={listId} />}
          {view === "gantt"    && <GanttView listId={listId} />}
        </div>
        {selectedTaskId && <TaskDetailPanel />}
      </div>

      {showModal && <CreateTaskModal listId={listId} onClose={() => setShowModal(false)} />}
    </div>
  );
}
