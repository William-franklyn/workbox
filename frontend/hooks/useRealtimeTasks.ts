"use client";
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTasksStore } from "@/store/tasks";
import { Task } from "@/store/workspace";

export function useRealtimeTasks(listId: string) {
  const { tasks, setTasks } = useTasksStore();

  useEffect(() => {
    if (!listId) return;
    const supabase = createClient();

    const channel = supabase
      .channel(`tasks:${listId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks", filter: `list_id=eq.${listId}` },
        (payload) => {
          const current = useTasksStore.getState().tasks[listId] || [];
          if (payload.eventType === "INSERT") {
            const exists = current.find((t) => t.id === (payload.new as Task).id);
            if (!exists) setTasks(listId, [...current, payload.new as Task]);
          } else if (payload.eventType === "UPDATE") {
            setTasks(listId, current.map((t) => t.id === (payload.new as Task).id ? { ...t, ...payload.new as Task } : t));
          } else if (payload.eventType === "DELETE") {
            setTasks(listId, current.filter((t) => t.id !== (payload.old as Task).id));
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [listId]);
}
