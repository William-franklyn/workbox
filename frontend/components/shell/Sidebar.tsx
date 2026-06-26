"use client";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useRef, useState } from "react";
import { useUIStore } from "@/store/ui";
import { useWorkspaceStore, Space, List } from "@/store/workspace";
import { createClient } from "@/lib/supabase/client";
import {
  LayoutDashboard, MessageSquare, Target, Zap, Settings,
  ChevronRight, ChevronDown, Plus, Plug, PanelLeftClose, PanelLeft,
  LogOut, List as ListIcon, FileText, BarChart2, Trash2,
} from "lucide-react";

interface Props { orgName: string; userRole: string; userName: string; userEmail: string; userId: string; }

const SPACE_ICONS = ["🚀","📦","🎨","📣","🏠","⚙️","🔬","💼","🌍","🎯"];
const SPACE_COLORS = ["#7c3aed","#3b82f6","#22c55e","#f59e0b","#ef4444","#ec4899","#06b6d4","#84cc16"];

export default function Sidebar({ orgName, userRole, userName, userEmail, userId }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const { sidebarCollapsed, toggleSidebar } = useUIStore();
  const { spaces, activeListId, toggleSpaceExpanded, toggleFolderExpanded, setActiveList, setActiveSpace, addSpace, addList, deleteSpace, deleteList } = useWorkspaceStore();

  // Inline creation state
  const [creatingSpace, setCreatingSpace] = useState(false);
  const [newSpaceName, setNewSpaceName] = useState("");
  const [creatingListIn, setCreatingListIn] = useState<string | null>(null); // spaceId
  const [newListName, setNewListName] = useState("");
  const spaceInputRef = useRef<HTMLInputElement>(null);
  const listInputRef = useRef<HTMLInputElement>(null);

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  function handleAddSpace() {
    setCreatingSpace(true);
    setNewSpaceName("");
    setTimeout(() => spaceInputRef.current?.focus(), 30);
  }

  function commitSpace() {
    const name = newSpaceName.trim();
    setCreatingSpace(false);
    if (!name) return;
    const icon = SPACE_ICONS[Math.floor(Math.random() * SPACE_ICONS.length)];
    const color = SPACE_COLORS[Math.floor(Math.random() * SPACE_COLORS.length)];
    const space: Space = {
      id: `s${Date.now()}`,
      name,
      icon,
      color,
      expanded: true,
      folders: [],
      lists: [],
    };
    addSpace(space);
  }

  function handleAddList(spaceId: string) {
    // expand the space first
    const space = spaces.find((s) => s.id === spaceId);
    if (space && !space.expanded) toggleSpaceExpanded(spaceId);
    setCreatingListIn(spaceId);
    setNewListName("");
    setTimeout(() => listInputRef.current?.focus(), 30);
  }

  function commitList(spaceId: string) {
    const name = newListName.trim();
    setCreatingListIn(null);
    if (!name) return;
    const space = spaces.find((s) => s.id === spaceId);
    const list: List = {
      id: `l${Date.now()}`,
      name,
      space_id: spaceId,
      color: space?.color ?? "#7c3aed",
      position: (space?.lists.length ?? 0),
    };
    addList(list, spaceId);
    setActiveList(list.id);
    router.push(`/tasks/${list.id}`);
  }

  const w = sidebarCollapsed ? "60px" : "240px";

  const navItems = [
    { icon: LayoutDashboard, label: "Home", href: "/home" },
    { icon: BarChart2, label: "Overview", href: "/overview" },
    { icon: FileText, label: "Docs", href: "/docs" },
    { icon: Target, label: "Goals", href: "/goals" },
    { icon: MessageSquare, label: "Chat", href: "/chat/new" },
    { icon: Zap, label: "Automations", href: "/automations" },
  ];

  return (
    <aside className="flex flex-col shrink-0 overflow-hidden transition-all duration-200 border-r"
      style={{ width: w, minWidth: w, background: "var(--bg-secondary)", borderColor: "var(--border)" }}>

      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b" style={{ borderColor: "var(--border)", height: "var(--topnav-height)" }}>
        {!sidebarCollapsed && (
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ background: "var(--accent-purple)" }}>
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
          const seg = href.split("/")[1];
          const active = seg ? pathname.startsWith(`/${seg}`) : pathname === href;
          return (
            <Link key={href} href={href}
              className="flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm transition-colors"
              style={{ color: active ? "var(--text-primary)" : "var(--text-secondary)", background: active ? "rgba(124,58,237,0.15)" : "transparent", borderLeft: active ? "2px solid var(--accent-purple)" : "2px solid transparent" }}>
              <Icon size={16} className="shrink-0" />
              {!sidebarCollapsed && <span>{label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Spaces */}
      {!sidebarCollapsed && (
        <div className="flex-1 overflow-y-auto px-2 pt-4 pb-2">
          {/* Section header */}
          <div className="flex items-center justify-between px-2 mb-1">
            <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-secondary)" }}>Spaces</span>
            <button onClick={handleAddSpace} title="New space"
              className="p-0.5 rounded hover:bg-white/10 transition-colors" style={{ color: "var(--text-secondary)" }}>
              <Plus size={13} />
            </button>
          </div>

          {/* New space inline input */}
          {creatingSpace && (
            <div className="flex items-center gap-2 px-2 py-1 mb-1 rounded-md" style={{ background: "rgba(124,58,237,0.1)" }}>
              <span className="text-sm">🚀</span>
              <input ref={spaceInputRef} value={newSpaceName} onChange={(e) => setNewSpaceName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") commitSpace(); if (e.key === "Escape") setCreatingSpace(false); }}
                onBlur={commitSpace}
                placeholder="Space name..."
                className="flex-1 bg-transparent outline-none text-sm"
                style={{ color: "var(--text-primary)" }}
              />
            </div>
          )}

          {/* Spaces list */}
          {spaces.map((space) => (
            <div key={space.id}>
              {/* Space row */}
              <div className="group flex items-center gap-1 rounded-md hover:bg-white/5 transition-colors"
                style={{ color: "var(--text-primary)" }}>
                <button onClick={() => { toggleSpaceExpanded(space.id); setActiveSpace(space.id); }}
                  className="flex items-center gap-2 flex-1 min-w-0 px-2 py-1.5 text-sm">
                  <span className="text-base leading-none flex-shrink-0">{space.icon}</span>
                  <span className="flex-1 text-left truncate font-medium">{space.name}</span>
                  {space.expanded ? <ChevronDown size={13} style={{ color: "var(--text-secondary)" }} /> : <ChevronRight size={13} style={{ color: "var(--text-secondary)" }} />}
                </button>
                {/* Hover actions */}
                <div className="flex items-center gap-0.5 pr-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={(e) => { e.stopPropagation(); handleAddList(space.id); }} title="Add list"
                    className="p-0.5 rounded hover:bg-white/10" style={{ color: "var(--text-secondary)" }}>
                    <Plus size={12} />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); if (confirm(`Delete "${space.name}"?`)) deleteSpace(space.id); }} title="Delete space"
                    className="p-0.5 rounded hover:bg-red-500/10" style={{ color: "var(--danger)" }}>
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>

              {/* Expanded content */}
              {space.expanded && (
                <div className="ml-3 border-l pl-2 mt-0.5 space-y-0.5" style={{ borderColor: "var(--border)" }}>
                  {/* Folders */}
                  {space.folders.map((folder) => (
                    <div key={folder.id}>
                      <button onClick={() => toggleFolderExpanded(space.id, folder.id)}
                        className="w-full flex items-center gap-2 px-2 py-1 rounded-md text-xs hover:bg-white/5 transition-colors"
                        style={{ color: "var(--text-secondary)" }}>
                        {folder.expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                        <span className="truncate">{folder.name}</span>
                      </button>
                      {folder.expanded && (
                        <div className="ml-3 space-y-0.5">
                          {folder.lists.map((list) => (
                            <ListRow key={list.id} list={list} active={activeListId === list.id}
                              onOpen={() => { setActiveList(list.id); router.push(`/tasks/${list.id}`); }}
                              onDelete={() => { if (confirm(`Delete "${list.name}"?`)) deleteList(list.id); }}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Direct lists */}
                  {space.lists.map((list) => (
                    <ListRow key={list.id} list={list} active={activeListId === list.id}
                      onOpen={() => { setActiveList(list.id); router.push(`/tasks/${list.id}`); }}
                      onDelete={() => { if (confirm(`Delete "${list.name}"?`)) deleteList(list.id); }}
                    />
                  ))}

                  {/* New list inline input */}
                  {creatingListIn === space.id && (
                    <div className="flex items-center gap-2 px-2 py-1 rounded-md" style={{ background: "rgba(124,58,237,0.08)" }}>
                      <ListIcon size={11} style={{ color: space.color }} />
                      <input ref={listInputRef} value={newListName} onChange={(e) => setNewListName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") commitList(space.id); if (e.key === "Escape") setCreatingListIn(null); }}
                        onBlur={() => commitList(space.id)}
                        placeholder="List name..."
                        className="flex-1 bg-transparent outline-none text-xs"
                        style={{ color: "var(--text-primary)" }}
                      />
                    </div>
                  )}

                  {/* Add list button (always visible inside expanded space) */}
                  {creatingListIn !== space.id && (
                    <button onClick={() => handleAddList(space.id)}
                      className="flex items-center gap-1.5 px-2 py-1 text-xs rounded-md w-full hover:bg-white/5 transition-colors"
                      style={{ color: "var(--text-secondary)" }}>
                      <Plus size={11} /> Add list
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* Empty state */}
          {spaces.length === 0 && !creatingSpace && (
            <button onClick={handleAddSpace}
              className="w-full text-center py-4 text-xs rounded-lg border-2 border-dashed hover:border-purple-500/50 transition-colors"
              style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
              + Create your first space
            </button>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="mt-auto border-t px-2 py-2 space-y-0.5" style={{ borderColor: "var(--border)" }}>
        {userRole === "admin" && (
          <Link href="/integrations" className="flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm hover:bg-white/5 transition-colors" style={{ color: "var(--text-secondary)" }}>
            <Plug size={15} />
            {!sidebarCollapsed && <span>Integrations</span>}
          </Link>
        )}
        <Link href="/settings" className="flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm hover:bg-white/5 transition-colors" style={{ color: "var(--text-secondary)" }}>
          <Settings size={15} />
          {!sidebarCollapsed && <span>Settings</span>}
        </Link>
        {!sidebarCollapsed && (
          <div className="flex items-center gap-2 px-2 py-2 mt-1">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ background: "var(--accent-purple)" }}>
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

function ListRow({ list, active, onOpen, onDelete }: { list: List; active: boolean; onOpen: () => void; onDelete: () => void }) {
  return (
    <div className="group flex items-center gap-1 rounded-md hover:bg-white/5 transition-colors"
      style={{ background: active ? "rgba(124,58,237,0.1)" : "transparent" }}>
      <button onClick={onOpen} className="flex items-center gap-2 flex-1 min-w-0 px-2 py-1 text-xs"
        style={{ color: active ? "var(--text-primary)" : "var(--text-secondary)" }}>
        <ListIcon size={11} style={{ color: list.color }} className="flex-shrink-0" />
        <span className="truncate">{list.name}</span>
      </button>
      <button onClick={(e) => { e.stopPropagation(); onDelete(); }}
        className="p-0.5 rounded hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity mr-1 flex-shrink-0"
        style={{ color: "var(--danger)" }}>
        <Trash2 size={10} />
      </button>
    </div>
  );
}
