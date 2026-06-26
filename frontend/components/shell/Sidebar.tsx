"use client";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { useUIStore } from "@/store/ui";
import { useWorkspaceStore } from "@/store/workspace";
import { createClient } from "@/lib/supabase/client";
import {
  LayoutDashboard, MessageSquare, Target, Zap, Settings,
  ChevronRight, ChevronDown, Plus, Plug, PanelLeftClose, PanelLeft,
  LogOut, List,
} from "lucide-react";

interface Props {
  orgName: string;
  userRole: string;
  userName: string;
  userEmail: string;
  userId: string;
}

export default function Sidebar({ orgName, userRole, userName, userEmail, userId }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const { sidebarCollapsed, toggleSidebar } = useUIStore();
  const { spaces, activeListId, toggleSpaceExpanded, toggleFolderExpanded, setActiveList, setActiveSpace } = useWorkspaceStore();

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  const w = sidebarCollapsed ? "60px" : "240px";

  const navItems = [
    { icon: LayoutDashboard, label: "Home", href: "/home" },
    { icon: MessageSquare, label: "Chat", href: "/chat/new" },
    { icon: Target, label: "Goals", href: "/goals" },
    { icon: Zap, label: "Automations", href: "/automations" },
  ];

  return (
    <aside
      className="flex flex-col shrink-0 overflow-hidden transition-all duration-200 border-r"
      style={{
        width: w,
        minWidth: w,
        background: "var(--bg-secondary)",
        borderColor: "var(--border)",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b" style={{ borderColor: "var(--border)", height: "var(--topnav-height)" }}>
        {!sidebarCollapsed && (
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold text-white shrink-0"
              style={{ background: "var(--accent-purple)" }}>
              {orgName[0]?.toUpperCase()}
            </div>
            <span className="font-semibold text-sm truncate" style={{ color: "var(--text-primary)" }}>{orgName}</span>
          </div>
        )}
        <button onClick={toggleSidebar} className="p-1 rounded-md hover:bg-white/10 transition-colors shrink-0" style={{ color: "var(--text-secondary)" }}>
          {sidebarCollapsed ? <PanelLeft size={16} /> : <PanelLeftClose size={16} />}
        </button>
      </div>

      {/* Nav items */}
      <nav className="px-2 pt-2 space-y-0.5">
        {navItems.map(({ icon: Icon, label, href }) => {
          const active = pathname.startsWith(href.split("/")[1] ? `/${href.split("/")[1]}` : href);
          return (
            <Link key={href} href={href}
              className="flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm transition-colors group"
              style={{
                color: active ? "var(--text-primary)" : "var(--text-secondary)",
                background: active ? "rgba(124,58,237,0.15)" : "transparent",
                borderLeft: active ? "2px solid var(--accent-purple)" : "2px solid transparent",
              }}
            >
              <Icon size={16} className="shrink-0" />
              {!sidebarCollapsed && <span>{label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Spaces */}
      {!sidebarCollapsed && (
        <div className="flex-1 overflow-y-auto px-2 pt-4 pb-2">
          <div className="flex items-center justify-between px-2 mb-1">
            <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-secondary)" }}>
              Spaces
            </span>
            <button className="p-0.5 rounded hover:bg-white/10 transition-colors" style={{ color: "var(--text-secondary)" }}>
              <Plus size={13} />
            </button>
          </div>

          {spaces.map((space) => (
            <div key={space.id}>
              {/* Space row */}
              <button
                onClick={() => { toggleSpaceExpanded(space.id); setActiveSpace(space.id); }}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-white/5 transition-colors group"
                style={{ color: "var(--text-primary)" }}
              >
                <span className="text-base leading-none">{space.icon}</span>
                <span className="flex-1 text-left truncate font-medium">{space.name}</span>
                {space.expanded ? <ChevronDown size={13} style={{ color: "var(--text-secondary)" }} /> : <ChevronRight size={13} style={{ color: "var(--text-secondary)" }} />}
              </button>

              {space.expanded && (
                <div className="ml-3 border-l pl-2 mt-0.5 space-y-0.5" style={{ borderColor: "var(--border)" }}>
                  {/* Folders */}
                  {space.folders.map((folder) => (
                    <div key={folder.id}>
                      <button
                        onClick={() => toggleFolderExpanded(space.id, folder.id)}
                        className="w-full flex items-center gap-2 px-2 py-1 rounded-md text-xs hover:bg-white/5 transition-colors"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        {folder.expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                        <span className="truncate">{folder.name}</span>
                      </button>
                      {folder.expanded && (
                        <div className="ml-3 space-y-0.5">
                          {folder.lists.map((list) => (
                            <button key={list.id}
                              onClick={() => { setActiveList(list.id); router.push(`/tasks/${list.id}`); }}
                              className="w-full flex items-center gap-2 px-2 py-1 rounded-md text-xs hover:bg-white/5 transition-colors"
                              style={{ color: activeListId === list.id ? "var(--text-primary)" : "var(--text-secondary)", background: activeListId === list.id ? "rgba(124,58,237,0.1)" : "transparent" }}
                            >
                              <List size={11} style={{ color: list.color }} />
                              <span className="truncate">{list.name}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Direct lists */}
                  {space.lists.map((list) => (
                    <button key={list.id}
                      onClick={() => { setActiveList(list.id); router.push(`/tasks/${list.id}`); }}
                      className="w-full flex items-center gap-2 px-2 py-1 rounded-md text-xs hover:bg-white/5 transition-colors"
                      style={{ color: activeListId === list.id ? "var(--text-primary)" : "var(--text-secondary)", background: activeListId === list.id ? "rgba(124,58,237,0.1)" : "transparent" }}
                    >
                      <List size={11} style={{ color: list.color }} />
                      <span className="truncate">{list.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="mt-auto border-t px-2 py-2 space-y-0.5" style={{ borderColor: "var(--border)" }}>
        {userRole === "admin" && (
          <Link href="/integrations"
            className="flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm hover:bg-white/5 transition-colors"
            style={{ color: "var(--text-secondary)" }}
          >
            <Plug size={15} />
            {!sidebarCollapsed && <span>Integrations</span>}
          </Link>
        )}
        <Link href="/settings"
          className="flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm hover:bg-white/5 transition-colors"
          style={{ color: "var(--text-secondary)" }}
        >
          <Settings size={15} />
          {!sidebarCollapsed && <span>Settings</span>}
        </Link>
        {!sidebarCollapsed && (
          <div className="flex items-center gap-2 px-2 py-2 mt-1">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
              style={{ background: "var(--accent-purple)" }}>
              {userName[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate" style={{ color: "var(--text-primary)" }}>{userName}</p>
              <p className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>{userEmail}</p>
            </div>
            <button onClick={logout} className="p-1 rounded hover:bg-white/10 transition-colors" style={{ color: "var(--text-secondary)" }}>
              <LogOut size={13} />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
