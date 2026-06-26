"use client";
import { use, useEffect } from "react";
import { useWorkspaceStore } from "@/store/workspace";
import { useTasksStore } from "@/store/tasks";
import { useRealtimeTasks } from "@/hooks/useRealtimeTasks";
import TaskListView from "@/components/tasks/TaskListView";
import KanbanBoard from "@/components/tasks/KanbanBoard";
import CalendarView from "@/components/tasks/CalendarView";
import TableView from "@/components/tasks/TableView";
import TaskDetailPanel from "@/components/tasks/TaskDetailPanel";
import GanttView from "@/components/tasks/GanttView";
import { Loader2 } from "lucide-react";

export default function TasksPage({ params }: { params: Promise<{ listId: string }> }) {
  const { listId } = use(params);
  const { view, selectedTaskId } = useWorkspaceStore();
  const { loadTasks, loadedLists } = useTasksStore();
  const isLoaded = loadedLists.has(listId);

  useEffect(() => { loadTasks(listId); }, [listId]);
  useRealtimeTasks(listId);

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 size={20} className="animate-spin" style={{ color: "var(--text-secondary)" }} />
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 overflow-hidden">
        {view === "list" && <TaskListView listId={listId} />}
        {view === "board" && <KanbanBoard listId={listId} />}
        {view === "calendar" && <CalendarView listId={listId} />}
        {view === "table" && <TableView listId={listId} />}
        {view === "gantt" && <GanttView listId={listId} />}
      </div>
      {selectedTaskId && <TaskDetailPanel />}
    </div>
  );
}
