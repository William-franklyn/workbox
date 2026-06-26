"use client";
import { useEffect, useRef, useState } from "react";
import { useUIStore } from "@/store/ui";
import { useWorkspaceStore } from "@/store/workspace";
import { useTasksStore } from "@/store/tasks";
import { Search, Bell, LayoutList, Kanban, Calendar, Table, Plus, CheckCheck } from "lucide-react";

interface Notification { id: string; type: string; title: string; body?: string; read: boolean; created_at: string; }

interface Props { orgName: string; userName: string; userId: string; }

export default function TopNav({ orgName, userName, userId }: Props) {
  const { setSearchOpen } = useUIStore();
  const { view, setView, spaces, activeListId } = useWorkspaceStore();
  const { addTask, tasks } = useTasksStore();

  const [notifOpen, setNotifOpen] = useState(false);
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const notifRef = useRef<HTMLDivElement>(null);

  const activeList = spaces.flatMap((s) => [...s.lists, ...s.folders.flatMap((f) => f.lists)]).find((l) => l.id === activeListId);
  const unread = notifs.filter((n) => !n.read).length;

  useEffect(() => {
    fetch("/api/notifications").then((r) => r.json()).then((d) => Array.isArray(d) && setNotifs(d)).catch(() => {});
  }, []);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  async function markAllRead() {
    await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: "all" }) });
    setNotifs((n) => n.map((x) => ({ ...x, read: true })));
  }

  async function markRead(id: string) {
    await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, read: true }) });
    setNotifs((n) => n.map((x) => x.id === id ? { ...x, read: true } : x));
  }

  function handleNewTask() {
    if (!activeListId) return;
    const title = prompt("New task name:");
    if (!title?.trim()) return;
    const task = { id: `t${Date.now()}`, title: title.trim(), status: "todo" as const, priority: "normal" as const, list_id: activeListId, position: (tasks[activeListId]?.length ?? 0), tags: [], created_at: new Date().toISOString() };
    addTask(task);
  }

  const views: { key: "list" | "board" | "calendar" | "table"; icon: React.ReactNode; label: string }[] = [
    { key: "list", icon: <LayoutList size={15} />, label: "List" },
    { key: "board", icon: <Kanban size={15} />, label: "Board" },
    { key: "calendar", icon: <Calendar size={15} />, label: "Calendar" },
    { key: "table", icon: <Table size={15} />, label: "Table" },
  ];

  return (
    <header className="flex items-center gap-3 px-4 border-b shrink-0" style={{ height: "var(--topnav-height)", background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
      {/* Breadcrumb */}
      <div className="flex items-center gap-1 text-sm min-w-0 flex-1">
        <span style={{ color: "var(--text-secondary)" }}>{orgName}</span>
        {activeList && (
          <>
            <span style={{ color: "var(--border)" }}>/</span>
            <span className="font-medium" style={{ color: "var(--text-primary)" }}>{activeList.name}</span>
          </>
        )}
      </div>

      {/* View switcher */}
      {activeListId && (
        <div className="flex items-center gap-0.5 rounded-lg p-0.5" style={{ background: "var(--bg-primary)" }}>
          {views.map(({ key, icon, label }) => (
            <button key={key} onClick={() => setView(key)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors"
              style={{ background: view === key ? "var(--bg-surface)" : "transparent", color: view === key ? "var(--text-primary)" : "var(--text-secondary)" }}>
              {icon} {label}
            </button>
          ))}
        </div>
      )}

      {/* Search */}
      <button onClick={() => setSearchOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors"
        style={{ background: "var(--bg-primary)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
        <Search size={14} />
        <span>Search...</span>
        <kbd className="text-xs px-1 rounded" style={{ background: "var(--border)", color: "var(--text-secondary)" }}>⌘K</kbd>
      </button>

      {/* New Task */}
      {activeListId && (
        <button onClick={handleNewTask}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-opacity hover:opacity-90"
          style={{ background: "var(--accent-purple)", color: "white" }}>
          <Plus size={14} /> New Task
        </button>
      )}

      {/* Notifications */}
      <div className="relative" ref={notifRef}>
        <button onClick={() => setNotifOpen((o) => !o)}
          className="relative p-2 rounded-lg hover:bg-white/5 transition-colors" style={{ color: "var(--text-secondary)" }}>
          <Bell size={16} />
          {unread > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 rounded-full text-white flex items-center justify-center text-xs font-bold leading-none"
              style={{ background: "var(--accent-purple)", fontSize: "9px" }}>{unread > 9 ? "9+" : unread}</span>
          )}
        </button>

        {notifOpen && (
          <div className="absolute right-0 top-full mt-2 w-80 rounded-xl shadow-xl border z-50 overflow-hidden"
            style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
            <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
              <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Notifications</span>
              {unread > 0 && (
                <button onClick={markAllRead} className="flex items-center gap-1 text-xs hover:opacity-80"
                  style={{ color: "var(--accent-purple)" }}>
                  <CheckCheck size={12} /> Mark all read
                </button>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notifs.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <Bell size={24} className="mx-auto mb-2 opacity-30" style={{ color: "var(--text-secondary)" }} />
                  <p className="text-xs" style={{ color: "var(--text-secondary)" }}>No notifications yet</p>
                </div>
              ) : notifs.map((n) => (
                <div key={n.id} onClick={() => markRead(n.id)}
                  className="flex items-start gap-3 px-4 py-3 border-b cursor-pointer hover:bg-white/2 transition-colors"
                  style={{ borderColor: "var(--border)", background: n.read ? "transparent" : "rgba(124,58,237,0.05)" }}>
                  <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                    style={{ background: n.read ? "transparent" : "var(--accent-purple)" }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>{n.title}</p>
                    {n.body && <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-secondary)" }}>{n.body}</p>}
                    <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
                      {new Date(n.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
