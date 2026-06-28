"use client";
import { useState } from "react";
import { X, Users, Lock } from "lucide-react";
import { useTasksStore } from "@/store/tasks";
import { Task } from "@/store/workspace";

interface Props {
  listId: string;
  initialStatus?: Task["status"];
  onClose: () => void;
}

export default function CreateTaskModal({ listId, initialStatus = "todo", onClose }: Props) {
  const { tasks, addTask } = useTasksStore();
  const [title, setTitle] = useState("");
  const [membersCanEdit, setMembersCanEdit] = useState(true);

  const listTasks = tasks[listId] ?? [];

  function handleCreate() {
    if (!title.trim()) return;
    addTask({
      id: `t${Date.now()}`,
      title: title.trim(),
      status: initialStatus,
      priority: "normal",
      list_id: listId,
      position: listTasks.length,
      tags: [],
      created_at: new Date().toISOString(),
      locked: !membersCanEdit,
    });
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={onClose}
    >
      <div
        className="rounded-2xl p-5 w-96 shadow-2xl"
        style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <p className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>New Task</p>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/10" style={{ color: "var(--text-secondary)" }}>
            <X size={14} />
          </button>
        </div>

        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") onClose(); }}
          placeholder="Task name..."
          className="w-full px-3 py-2 rounded-lg text-sm outline-none mb-4"
          style={{ background: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
          onFocus={(e) => (e.target.style.borderColor = "var(--accent-purple)")}
          onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
        />

        <div className="mb-4 p-3 rounded-lg" style={{ background: "var(--bg-primary)", border: "1px solid var(--border)" }}>
          <p className="text-xs font-medium mb-2.5" style={{ color: "var(--text-secondary)" }}>
            Who can modify this task?
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setMembersCanEdit(true)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all"
              style={{
                background: membersCanEdit ? "var(--accent-purple)" : "transparent",
                color: membersCanEdit ? "white" : "var(--text-secondary)",
                border: `1px solid ${membersCanEdit ? "var(--accent-purple)" : "var(--border)"}`,
              }}
            >
              <Users size={11} /> Everyone
            </button>
            <button
              onClick={() => setMembersCanEdit(false)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all"
              style={{
                background: !membersCanEdit ? "var(--accent-purple)" : "transparent",
                color: !membersCanEdit ? "white" : "var(--text-secondary)",
                border: `1px solid ${!membersCanEdit ? "var(--accent-purple)" : "var(--border)"}`,
              }}
            >
              <Lock size={11} /> Admin only
            </button>
          </div>
          {!membersCanEdit && (
            <p className="text-xs mt-2 leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              Members can view this task and change its status, but cannot edit any details. They can request a deadline extension from the admin.
            </p>
          )}
        </div>

        <button
          onClick={handleCreate}
          disabled={!title.trim()}
          className="w-full py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-40 transition-opacity hover:opacity-90"
          style={{ background: "var(--accent-purple)" }}
        >
          Create Task
        </button>
      </div>
    </div>
  );
}
