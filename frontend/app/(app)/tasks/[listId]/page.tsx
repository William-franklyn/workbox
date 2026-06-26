"use client";
import { use } from "react";
import { useWorkspaceStore } from "@/store/workspace";
import TaskListView from "@/components/tasks/TaskListView";
import KanbanBoard from "@/components/tasks/KanbanBoard";
import CalendarView from "@/components/tasks/CalendarView";
import TableView from "@/components/tasks/TableView";

export default function TasksPage({ params }: { params: Promise<{ listId: string }> }) {
  const { listId } = use(params);
  const { view } = useWorkspaceStore();

  return (
    <div className="h-full overflow-hidden">
      {view === "list" && <TaskListView listId={listId} />}
      {view === "board" && <KanbanBoard listId={listId} />}
      {view === "calendar" && <CalendarView listId={listId} />}
      {view === "table" && <TableView listId={listId} />}
    </div>
  );
}
