"use client";
import { use } from "react";
import { useWorkspaceStore } from "@/store/workspace";
import TaskListView from "@/components/tasks/TaskListView";
import KanbanBoard from "@/components/tasks/KanbanBoard";

export default function TasksPage({ params }: { params: Promise<{ listId: string }> }) {
  const { listId } = use(params);
  const { view } = useWorkspaceStore();

  return (
    <div className="h-full overflow-hidden">
      {view === "list" && <TaskListView listId={listId} />}
      {view === "board" && <KanbanBoard listId={listId} />}
      {(view === "calendar" || view === "table") && (
        <div className="flex items-center justify-center h-full">
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{view.charAt(0).toUpperCase() + view.slice(1)} view coming soon</p>
        </div>
      )}
    </div>
  );
}
