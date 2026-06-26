import { create } from "zustand";
import { Task } from "./workspace";

interface TasksState {
  tasks: Record<string, Task[]>; // keyed by list_id
  setTasks: (listId: string, tasks: Task[]) => void;
  addTask: (task: Task) => void;
  updateTask: (id: string, patch: Partial<Task>) => void;
  moveTask: (id: string, newStatus: Task["status"]) => void;
}

const DEMO_TASKS: Task[] = [
  { id: "t1", title: "Set up CI/CD pipeline", status: "done", priority: "high", list_id: "l2", position: 0, tags: ["devops"], created_at: new Date().toISOString() },
  { id: "t2", title: "Design system tokens", status: "in_progress", priority: "normal", list_id: "l2", position: 1, tags: ["design"], created_at: new Date().toISOString() },
  { id: "t3", title: "API authentication flow", status: "in_progress", priority: "urgent", list_id: "l2", position: 2, tags: ["backend", "auth"], created_at: new Date().toISOString() },
  { id: "t4", title: "Write unit tests for auth module", status: "todo", priority: "high", list_id: "l2", position: 3, tags: ["testing"], created_at: new Date().toISOString() },
  { id: "t5", title: "Deploy staging environment", status: "todo", priority: "normal", list_id: "l2", position: 4, tags: ["devops"], created_at: new Date().toISOString() },
  { id: "t6", title: "Code review for PR #42", status: "in_review", priority: "high", list_id: "l2", position: 5, tags: [], created_at: new Date().toISOString() },
  { id: "t7", title: "Update API documentation", status: "todo", priority: "low", list_id: "l2", position: 6, tags: ["docs"], created_at: new Date().toISOString() },
];

export const useTasksStore = create<TasksState>((set) => ({
  tasks: { l2: DEMO_TASKS },
  setTasks: (listId, tasks) => set((s) => ({ tasks: { ...s.tasks, [listId]: tasks } })),
  addTask: (task) =>
    set((s) => ({
      tasks: {
        ...s.tasks,
        [task.list_id]: [...(s.tasks[task.list_id] || []), task],
      },
    })),
  updateTask: (id, patch) =>
    set((s) => {
      const next = { ...s.tasks };
      for (const listId in next) {
        next[listId] = next[listId].map((t) => (t.id === id ? { ...t, ...patch } : t));
      }
      return { tasks: next };
    }),
  moveTask: (id, newStatus) =>
    set((s) => {
      const next = { ...s.tasks };
      for (const listId in next) {
        next[listId] = next[listId].map((t) => (t.id === id ? { ...t, status: newStatus } : t));
      }
      return { tasks: next };
    }),
}));
