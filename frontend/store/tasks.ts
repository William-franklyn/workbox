import { create } from "zustand";
import { Task } from "./workspace";
import { toast } from "./toast";
import { track } from "@/lib/analytics";

interface TasksState {
  tasks: Record<string, Task[]>; // keyed by list_id
  loadedLists: Set<string>;

  // Load from Supabase for a given list
  loadTasks: (listId: string) => Promise<void>;
  reloadTasks: (listId: string) => Promise<void>;

  setTasks: (listId: string, tasks: Task[]) => void;
  addTask: (task: Task) => void;
  updateTask: (id: string, patch: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  moveTask: (id: string, newStatus: Task["status"]) => void;
}

export const useTasksStore = create<TasksState>((set, get) => ({
  tasks: {},
  loadedLists: new Set(),

  loadTasks: async (listId) => {
    if (get().loadedLists.has(listId)) return;
    try {
      const res = await fetch(`/api/tasks?listId=${listId}`);
      if (!res.ok) return;
      const data: Task[] = await res.json();
      set((s) => ({
        tasks: { ...s.tasks, [listId]: data },
        loadedLists: new Set([...s.loadedLists, listId]),
      }));
    } catch {}
  },

  reloadTasks: async (listId) => {
    try {
      const res = await fetch(`/api/tasks?listId=${listId}`);
      if (!res.ok) return;
      const data: Task[] = await res.json();
      set((s) => ({
        tasks: { ...s.tasks, [listId]: data },
        loadedLists: new Set([...s.loadedLists, listId]),
      }));
    } catch {}
  },

  setTasks: (listId, tasks) =>
    set((s) => ({
      tasks: { ...s.tasks, [listId]: tasks },
      loadedLists: new Set([...s.loadedLists, listId]),
    })),

  addTask: (task) => {
    set((s) => ({
      tasks: { ...s.tasks, [task.list_id]: [...(s.tasks[task.list_id] || []), task] },
    }));
    fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(task),
    }).then(async (res) => {
      if (res.ok) {
        const saved = await res.json();
        if (saved.id !== task.id) {
          set((s) => {
            const listTasks = (s.tasks[task.list_id] || []).map((t) => t.id === task.id ? { ...t, ...saved } : t);
            return { tasks: { ...s.tasks, [task.list_id]: listTasks } };
          });
        }
        toast(`Task created: ${task.title.length > 40 ? task.title.slice(0, 40) + "…" : task.title}`, {
          actionLabel: "Undo",
          onAction: () => get().deleteTask(saved.id ?? task.id),
        });
        track("task_created", { has_due_date: !!task.due_date, priority: task.priority });
      } else {
        const err = await res.json().catch(() => ({}));
        toast(err.error ?? "Failed to create task", { type: "error" });
        // Roll back the optimistic insert
        set((s) => ({
          tasks: { ...s.tasks, [task.list_id]: (s.tasks[task.list_id] || []).filter((t) => t.id !== task.id) },
        }));
      }
    }).catch(() => {});
    // Fire notification
    fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: `n${Date.now()}`, title: `New task: ${task.title}`, body: "", read: false }),
    }).catch(() => {});
  },

  updateTask: (id, patch) => {
    const prev = Object.values(get().tasks).flat().find((t) => t.id === id);
    set((s) => {
      const next = { ...s.tasks };
      for (const listId in next) {
        next[listId] = next[listId].map((t) => (t.id === id ? { ...t, ...patch } : t));
      }
      return { tasks: next };
    });
    fetch("/api/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...patch }),
    }).catch(() => {});
    // Notify on completion
    if (patch.status === "done" && prev?.status !== "done") {
      fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: `n${Date.now()}`, title: `Task completed: ${prev?.title ?? ""}`, body: "", read: false }),
      }).catch(() => {});
    }
  },

  deleteTask: (id) => {
    set((s) => {
      const next = { ...s.tasks };
      for (const listId in next) {
        next[listId] = next[listId].filter((t) => t.id !== id);
      }
      return { tasks: next };
    });
    fetch("/api/tasks", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    }).catch(() => {});
  },

  moveTask: (id, newStatus) => {
    set((s) => {
      const next = { ...s.tasks };
      for (const listId in next) {
        next[listId] = next[listId].map((t) => (t.id === id ? { ...t, status: newStatus } : t));
      }
      return { tasks: next };
    });
    fetch("/api/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: newStatus }),
    }).catch(() => {});
  },
}));
