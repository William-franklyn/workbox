"use client";
import { useUIStore } from "@/store/ui";
import { useWorkspaceStore } from "@/store/workspace";
import { Search, Bell, LayoutList, Kanban, Calendar, Table, Plus } from "lucide-react";

interface Props { orgName: string; userName: string; }

export default function TopNav({ orgName, userName }: Props) {
  const { setSearchOpen } = useUIStore();
  const { view, setView, spaces, activeListId } = useWorkspaceStore();

  const activeList = spaces
    .flatMap((s) => [...s.lists, ...s.folders.flatMap((f) => f.lists)])
    .find((l) => l.id === activeListId);

  const views: { key: "list" | "board" | "calendar" | "table"; icon: React.ReactNode; label: string }[] = [
    { key: "list", icon: <LayoutList size={15} />, label: "List" },
    { key: "board", icon: <Kanban size={15} />, label: "Board" },
    { key: "calendar", icon: <Calendar size={15} />, label: "Calendar" },
    { key: "table", icon: <Table size={15} />, label: "Table" },
  ];

  return (
    <header
      className="flex items-center gap-3 px-4 border-b shrink-0"
      style={{
        height: "var(--topnav-height)",
        background: "var(--bg-secondary)",
        borderColor: "var(--border)",
      }}
    >
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
            <button
              key={key}
              onClick={() => setView(key)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors"
              style={{
                background: view === key ? "var(--bg-surface)" : "transparent",
                color: view === key ? "var(--text-primary)" : "var(--text-secondary)",
              }}
            >
              {icon} {label}
            </button>
          ))}
        </div>
      )}

      {/* Search */}
      <button
        onClick={() => setSearchOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors"
        style={{ background: "var(--bg-primary)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
      >
        <Search size={14} />
        <span>Search...</span>
        <kbd className="text-xs px-1 rounded" style={{ background: "var(--border)", color: "var(--text-secondary)" }}>⌘K</kbd>
      </button>

      {/* Add task */}
      {activeListId && (
        <button
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-opacity hover:opacity-90"
          style={{ background: "var(--accent-purple)", color: "white" }}
        >
          <Plus size={14} /> New Task
        </button>
      )}

      {/* Notifications */}
      <button className="relative p-2 rounded-lg hover:bg-white/5 transition-colors" style={{ color: "var(--text-secondary)" }}>
        <Bell size={16} />
        <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full" style={{ background: "var(--accent-purple)" }} />
      </button>
    </header>
  );
}
