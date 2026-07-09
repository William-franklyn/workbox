"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useUIStore } from "@/store/ui";
import { useWorkspaceStore } from "@/store/workspace";
import { Search, Bell, CheckCheck, Menu, ChevronRight, MessageSquare, CalendarDays } from "lucide-react";

interface Notification { id: string; type: string; title: string; body?: string; read: boolean; created_at: string; }
interface Props { orgName: string; userName: string; userId: string; }

export default function TopNav({ orgName, userName, userId }: Props) {
  const { setSearchOpen, toggleSidebar } = useUIStore();
  const { spaces, activeListId } = useWorkspaceStore();

  const [notifOpen, setNotifOpen] = useState(false);
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const notifRef = useRef<HTMLDivElement>(null);

  const activeSpace = spaces.find((s) =>
    [...s.lists, ...s.folders.flatMap((f) => f.lists)].some((l) => l.id === activeListId)
  );
  const activeList = spaces
    .flatMap((s) => [...s.lists, ...s.folders.flatMap((f) => f.lists)])
    .find((l) => l.id === activeListId);
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
    setNotifs((n) => n.map((x) => (x.id === id ? { ...x, read: true } : x)));
  }

  return (
    <header
      className="flex items-center gap-3 px-4 shrink-0"
      style={{
        height: "var(--topnav-height)",
        background: "var(--bg-secondary)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      {/* Mobile menu */}
      <button
        onClick={toggleSidebar}
        className="md:hidden p-1.5 rounded-lg transition-colors"
        style={{ color: "var(--text-secondary)" }}
      >
        <Menu size={18} />
      </button>

      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm min-w-0 flex-1">
        <span className="font-medium" style={{ color: "var(--text-muted)" }}>{orgName}</span>
        {activeSpace && (
          <>
            <ChevronRight size={12} style={{ color: "var(--text-muted)" }} />
            <span style={{ color: "var(--text-secondary)" }}>{activeSpace.icon} {activeSpace.name}</span>
          </>
        )}
        {activeList && (
          <>
            <ChevronRight size={12} style={{ color: "var(--text-muted)" }} />
            <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{activeList.name}</span>
          </>
        )}
      </div>

      {/* Search trigger */}
      <button
        onClick={() => setSearchOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors"
        style={{
          background: "var(--bg-surface)",
          color: "var(--text-secondary)",
          border: "1px solid var(--border-strong)",
        }}
      >
        <Search size={13} />
        <span className="hidden sm:inline text-xs">Search…</span>
        <kbd
          className="text-xs px-1.5 py-0.5 rounded hidden sm:inline font-mono"
          style={{ background: "var(--bg-elevated)", color: "var(--text-muted)", border: "1px solid var(--border-strong)" }}
        >
          ⌘K
        </kbd>
      </button>

      {/* Divider between search and the action cluster */}
      <div className="w-px h-5 mx-1 hidden sm:block" style={{ background: "var(--border)" }} />

      {/* Team chat — lives here, next to notifications */}
      <Link
        href="/team-chat"
        title="Team Chat"
        className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-white/5"
        style={{ color: "var(--text-secondary)" }}
      >
        <MessageSquare size={16} strokeWidth={1.75} />
      </Link>

      {/* Meetings shortcut */}
      <Link
        href="/meetings"
        title="Meetings"
        className="w-8 h-8 rounded-lg hidden sm:flex items-center justify-center transition-colors hover:bg-white/5"
        style={{ color: "var(--text-secondary)" }}
      >
        <CalendarDays size={16} strokeWidth={1.75} />
      </Link>

      {/* Notifications */}
      <div className="relative" ref={notifRef}>
        <button
          onClick={() => setNotifOpen((o) => !o)}
          className="relative w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
          style={{
            color: "var(--text-secondary)",
            background: notifOpen ? "var(--bg-surface)" : "transparent",
          }}
        >
          <Bell size={16} strokeWidth={1.75} />
          {unread > 0 && (
            <span
              className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full text-white flex items-center justify-center font-bold leading-none"
              style={{ background: "var(--accent-purple)", fontSize: "8px" }}
            >
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>

        {notifOpen && (
          <div
            className="absolute right-0 top-full mt-2 w-80 rounded-xl shadow-2xl border z-50 overflow-hidden"
            style={{
              background: "var(--bg-elevated)",
              borderColor: "var(--border-strong)",
              boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
            }}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
              <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Notifications</span>
              {unread > 0 && (
                <button onClick={markAllRead} className="flex items-center gap-1 text-xs hover:opacity-80 transition-opacity" style={{ color: "var(--accent-purple)" }}>
                  <CheckCheck size={12} /> Mark all read
                </button>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notifs.length === 0 ? (
                <div className="px-4 py-10 text-center">
                  <Bell size={22} className="mx-auto mb-2" style={{ color: "var(--text-muted)" }} />
                  <p className="text-xs" style={{ color: "var(--text-secondary)" }}>All caught up</p>
                </div>
              ) : notifs.map((n) => (
                <div
                  key={n.id}
                  onClick={() => markRead(n.id)}
                  className="flex items-start gap-3 px-4 py-3 border-b cursor-pointer transition-colors"
                  style={{
                    borderColor: "var(--border)",
                    background: n.read ? "transparent" : "rgba(124,58,237,0.05)",
                  }}
                >
                  <div
                    className="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0"
                    style={{ background: n.read ? "transparent" : "var(--accent-purple)" }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>{n.title}</p>
                    {n.body && <p className="text-xs mt-0.5 line-clamp-1" style={{ color: "var(--text-secondary)" }}>{n.body}</p>}
                    <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                      {new Date(n.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* User avatar */}
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
        style={{ background: "#ffffff", color: "#000000" }}
      >
        {userName?.[0]?.toUpperCase() ?? "?"}
      </div>
    </header>
  );
}
