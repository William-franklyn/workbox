"use client";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useRef, useState, useEffect } from "react";
import { useUIStore } from "@/store/ui";
import { useWorkspaceStore, Space, List } from "@/store/workspace";
import { createClient } from "@/lib/supabase/client";
import {
  Zap, Settings,
  ChevronRight, ChevronDown, Plus, Plug, PanelLeftClose, PanelLeft,
  LogOut, List as ListIcon, FileText, BarChart2, Trash2, FolderPlus,
  Folder, Users, X, CheckCircle2,
} from "lucide-react";

interface Props { orgName: string; userRole: string; userName: string; userEmail: string; userId: string; }

const SPACE_ICONS  = ["🚀","📦","🎨","📣","🏠","⚙️","🔬","💼","🌍","🎯"];
const SPACE_COLORS = ["#ffffff","#e0e0e0","#c0c0c0","#a0a0a0","#808080","#606060","#404040","#282828"];

export default function Sidebar({ orgName, userRole, userName, userEmail, userId }: Props) {
  const router   = useRouter();
  const pathname = usePathname();
  const { sidebarCollapsed, toggleSidebar } = useUIStore();
  const {
    spaces, activeListId,
    toggleSpaceExpanded, toggleFolderExpanded,
    setActiveList, setActiveSpace,
    addSpace, addList, deleteSpace, deleteList,
    renameSpace, renameList,
  } = useWorkspaceStore();

  const [membersSpaceId, setMembersSpaceId]   = useState<string | null>(null);
  const [spaceMembers, setSpaceMembers]       = useState<{ id: string; full_name: string; role: string }[]>([]);
  const [membersLoading, setMembersLoading]   = useState(false);

  async function openMembers(spaceId: string) {
    setMembersSpaceId(spaceId);
    setMembersLoading(true);
    const res = await fetch("/api/members");
    if (res.ok) setSpaceMembers(await res.json());
    setMembersLoading(false);
  }

  const [creatingSpace,   setCreatingSpace]   = useState(false);
  const [newSpaceName,    setNewSpaceName]     = useState("");
  const [creatingListIn,  setCreatingListIn]   = useState<string | null>(null);
  const [newListName,     setNewListName]      = useState("");
  const [creatingFolderIn,setCreatingFolderIn] = useState<string | null>(null);
  const [newFolderName,   setNewFolderName]    = useState("");
  const spaceInputRef  = useRef<HTMLInputElement>(null);
  const listInputRef   = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const [renamingId,   setRenamingId]   = useState<string | null>(null);
  const [renameType,   setRenameType]   = useState<"space" | "list" | null>(null);
  const [renameValue,  setRenameValue]  = useState("");
  const [gcalConnected,setGcalConnected]= useState(false);

  useEffect(() => {
    fetch("/api/google-calendar/status")
      .then(r => r.ok ? r.json() : { connected: false })
      .then(d => setGcalConnected(d.connected))
      .catch(() => {});
  }, []);

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  function handleAddSpace() { setCreatingSpace(true); setNewSpaceName(""); setTimeout(() => spaceInputRef.current?.focus(), 30); }
  function commitSpace() {
    const name = newSpaceName.trim();
    setCreatingSpace(false);
    if (!name) return;
    addSpace({
      id: `s${Date.now()}`, name,
      icon:  SPACE_ICONS[Math.floor(Math.random()  * SPACE_ICONS.length)],
      color: SPACE_COLORS[Math.floor(Math.random() * SPACE_COLORS.length)],
      expanded: true, folders: [], lists: [],
    });
  }

  function handleAddFolder(spaceId: string) {
    const space = spaces.find(s => s.id === spaceId);
    if (space && !space.expanded) toggleSpaceExpanded(spaceId);
    setCreatingFolderIn(spaceId); setNewFolderName("");
    setTimeout(() => folderInputRef.current?.focus(), 30);
  }
  function commitFolder(spaceId: string) {
    const name = newFolderName.trim(); setCreatingFolderIn(null);
    if (!name) return;
    const { addFolder } = useWorkspaceStore.getState();
    addFolder({ id: `f${Date.now()}`, name, space_id: spaceId, expanded: true, lists: [] }, spaceId);
  }

  function handleAddList(spaceId: string) {
    const space = spaces.find(s => s.id === spaceId);
    if (space && !space.expanded) toggleSpaceExpanded(spaceId);
    setCreatingListIn(spaceId); setNewListName("");
    setTimeout(() => listInputRef.current?.focus(), 30);
  }
  function commitList(spaceId: string) {
    const name = newListName.trim(); setCreatingListIn(null);
    if (!name) return;
    const space = spaces.find(s => s.id === spaceId);
    const list: List = { id: `l${Date.now()}`, name, space_id: spaceId, color: space?.color ?? "#7c3aed", position: space?.lists.length ?? 0 };
    addList(list, spaceId); setActiveList(list.id); router.push(`/tasks/${list.id}`);
  }

  function startRename(id: string, type: "space" | "list", currentName: string) {
    setRenamingId(id); setRenameType(type); setRenameValue(currentName);
    setTimeout(() => renameInputRef.current?.select(), 30);
  }
  function commitRename() {
    const name = renameValue.trim();
    if (name && renamingId && renameType) {
      if (renameType === "space") renameSpace(renamingId, name);
      else renameList(renamingId, name);
    }
    setRenamingId(null); setRenameType(null);
  }

  const w = sidebarCollapsed ? "0px" : "220px";

  return (
    <>
      <aside
        className="flex flex-col shrink-0 overflow-hidden transition-all duration-200"
        style={{
          width: w, minWidth: w,
          background: "var(--bg-secondary)",
          borderRight: "1px solid var(--border)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-3 shrink-0"
          style={{ height: "var(--topnav-height)", borderBottom: "1px solid var(--border)" }}
        >
          {!sidebarCollapsed && (
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold text-white shrink-0"
                style={{ background: "linear-gradient(145deg, #2a2a2a, #161616)", boxShadow: "0 0 0 1px rgba(255,255,255,0.1)" }}
              >
                W
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-sm truncate leading-tight" style={{ color: "var(--text-primary)" }}>Workspace</p>
                <p className="text-xs truncate leading-tight" style={{ color: "var(--text-muted)" }}>{orgName}</p>
              </div>
            </div>
          )}
          <button
            onClick={toggleSidebar}
            className="p-1.5 rounded-lg transition-colors shrink-0"
            style={{ color: "var(--text-secondary)" }}
          >
            {sidebarCollapsed ? <PanelLeft size={15} /> : <PanelLeftClose size={15} />}
          </button>
        </div>

        {/* Main nav + spaces */}
        {!sidebarCollapsed && (
          <div className="flex-1 overflow-y-auto px-2 pt-3 pb-2">

            {/* Spaces section */}
            <div className="flex items-center justify-between px-2.5 mb-2">
              <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: "var(--text-muted)" }}>Spaces</span>
              <button onClick={handleAddSpace} className="p-0.5 rounded transition-colors" style={{ color: "var(--text-secondary)" }}>
                <Plus size={13} />
              </button>
            </div>

            {/* New space input */}
            {creatingSpace && (
              <div className="flex items-center gap-2 px-2.5 py-1.5 mb-1 rounded-lg" style={{ background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.15)" }}>
                <span className="text-sm">🚀</span>
                <input ref={spaceInputRef} value={newSpaceName} onChange={(e) => setNewSpaceName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") commitSpace(); if (e.key === "Escape") setCreatingSpace(false); }}
                  onBlur={commitSpace} placeholder="Space name…"
                  className="flex-1 bg-transparent outline-none text-sm"
                  style={{ color: "var(--text-primary)" }}
                />
              </div>
            )}

            {/* Spaces list */}
            {spaces.map((space) => {
              const isPersonal = space.name === "My Workspace";
              return (
                <div key={space.id}>
                  <div className="group flex items-center rounded-lg transition-colors" style={{ color: "var(--text-primary)" }}>
                    <button
                      onClick={() => { toggleSpaceExpanded(space.id); setActiveSpace(space.id); }}
                      className="flex items-center gap-2 flex-1 min-w-0 px-2 py-1.5 text-sm"
                    >
                      <span className="text-sm leading-none shrink-0">{space.icon}</span>
                      {renamingId === space.id ? (
                        <input ref={renameInputRef} value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") setRenamingId(null); }}
                          onBlur={commitRename} onClick={(e) => e.stopPropagation()}
                          className="flex-1 bg-transparent outline-none font-medium text-sm min-w-0"
                          style={{ color: "var(--text-primary)" }}
                        />
                      ) : (
                        <span className="flex-1 text-left truncate font-medium text-sm"
                          style={{ color: "var(--text-primary)" }}
                          onDoubleClick={(e) => { e.stopPropagation(); startRename(space.id, "space", space.name); }}>
                          {space.name}
                        </span>
                      )}
                      {space.expanded
                        ? <ChevronDown size={12} style={{ color: "var(--text-muted)" }} />
                        : <ChevronRight size={12} style={{ color: "var(--text-muted)" }} />
                      }
                    </button>
                    <div className="flex items-center gap-0.5 pr-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={(e) => { e.stopPropagation(); handleAddList(space.id); }} title="Add list"
                        className="p-1 rounded transition-colors" style={{ color: "var(--text-secondary)" }}>
                        <Plus size={11} />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); handleAddFolder(space.id); }} title="Add folder"
                        className="p-1 rounded transition-colors" style={{ color: "var(--text-secondary)" }}>
                        <FolderPlus size={11} />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); openMembers(space.id); }} title="Members"
                        className="p-1 rounded transition-colors" style={{ color: "var(--text-secondary)" }}>
                        <Users size={11} />
                      </button>
                      {!isPersonal && (
                        <button onClick={(e) => { e.stopPropagation(); if (confirm(`Delete "${space.name}"?`)) deleteSpace(space.id); }}
                          className="p-1 rounded transition-colors" style={{ color: "var(--danger)" }}>
                          <Trash2 size={11} />
                        </button>
                      )}
                    </div>
                  </div>

                  {space.expanded && (
                    <div className="ml-4 pl-2 mt-0.5 space-y-0.5" style={{ borderLeft: "1px solid var(--border)" }}>
                      {/* Folders */}
                      {space.folders.map((folder) => (
                        <div key={folder.id}>
                          <div className="group/folder flex items-center rounded-lg transition-colors">
                            <button onClick={() => toggleFolderExpanded(space.id, folder.id)} className="p-1 shrink-0" style={{ color: "var(--text-muted)" }}>
                              {folder.expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                            </button>
                            <button onClick={() => router.push(`/folder/${folder.id}`)}
                              className="flex items-center gap-1.5 flex-1 min-w-0 py-1 pr-2 text-xs text-left"
                              style={{ color: "var(--text-secondary)" }}>
                              <Folder size={10} className="shrink-0" />
                              <span className="truncate">{folder.name}</span>
                            </button>
                          </div>
                          {folder.expanded && (
                            <div className="ml-3 space-y-0.5">
                              {folder.lists.map((list) => (
                                <ListRow key={list.id} list={list} active={activeListId === list.id}
                                  onOpen={() => { setActiveList(list.id); router.push(`/tasks/${list.id}`); }}
                                  onDelete={() => { if (confirm(`Delete "${list.name}"?`)) deleteList(list.id); }}
                                  onRename={() => startRename(list.id, "list", list.name)}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      ))}

                      {/* New folder input */}
                      {creatingFolderIn === space.id && (
                        <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg mb-0.5" style={{ background: "rgba(124,58,237,0.07)" }}>
                          <Folder size={10} style={{ color: "var(--text-secondary)" }} />
                          <input ref={folderInputRef} value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") commitFolder(space.id); if (e.key === "Escape") setCreatingFolderIn(null); }}
                            onBlur={() => commitFolder(space.id)} placeholder="Folder name…"
                            className="flex-1 bg-transparent outline-none text-xs"
                            style={{ color: "var(--text-primary)" }}
                          />
                        </div>
                      )}

                      {/* Direct lists */}
                      {space.lists.map((list) => {
                        const isProtected = isPersonal && list.name === "My Tasks";
                        if (renamingId === list.id) {
                          return (
                            <div key={list.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg"
                              style={{ background: "rgba(124,58,237,0.07)" }}>
                              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: list.color }} />
                              <input ref={renameInputRef} value={renameValue}
                                onChange={(e) => setRenameValue(e.target.value)}
                                onKeyDown={(e) => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") setRenamingId(null); }}
                                onBlur={commitRename}
                                className="flex-1 bg-transparent outline-none text-xs min-w-0"
                                style={{ color: "var(--text-primary)" }}
                              />
                            </div>
                          );
                        }
                        return (
                          <ListRow key={list.id} list={list} active={activeListId === list.id}
                            onOpen={() => { setActiveList(list.id); router.push(`/tasks/${list.id}`); }}
                            onDelete={isProtected ? undefined : () => { if (confirm(`Delete "${list.name}"?`)) deleteList(list.id); }}
                            onRename={() => startRename(list.id, "list", list.name)}
                          />
                        );
                      })}

                      {/* New list input */}
                      {creatingListIn === space.id && (
                        <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg" style={{ background: "rgba(124,58,237,0.07)" }}>
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: space.color }} />
                          <input ref={listInputRef} value={newListName} onChange={(e) => setNewListName(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") commitList(space.id); if (e.key === "Escape") setCreatingListIn(null); }}
                            onBlur={() => commitList(space.id)} placeholder="List name…"
                            className="flex-1 bg-transparent outline-none text-xs"
                            style={{ color: "var(--text-primary)" }}
                          />
                        </div>
                      )}

                      {creatingListIn !== space.id && (
                        <button onClick={() => handleAddList(space.id)}
                          className="flex items-center gap-1.5 px-2 py-1 text-xs rounded-lg w-full transition-colors"
                          style={{ color: "var(--text-muted)" }}>
                          <Plus size={10} /> Add list
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {spaces.length === 0 && !creatingSpace && (
              <button onClick={handleAddSpace}
                className="w-full text-center py-5 text-xs rounded-xl transition-colors"
                style={{ border: "1px dashed var(--border-strong)", color: "var(--text-secondary)" }}>
                + Create your first space
              </button>
            )}
          </div>
        )}

        {/* Integrations quick strip */}
        {!sidebarCollapsed && (
          <div className="px-2 pt-2 pb-2" style={{ borderTop: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between px-2 mb-1.5">
              <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Integrations</span>
              <Link href="/integrations" className="text-xs transition-opacity hover:opacity-70" style={{ color: "var(--accent-purple)" }}>Manage</Link>
            </div>
            <Link href={gcalConnected ? "/meetings" : "/integrations"}
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors text-xs"
              style={{ color: "var(--text-secondary)" }}>
              <div className="w-4 h-4 rounded flex items-center justify-center text-white shrink-0"
                style={{ background: "#4285F4", fontSize: 9, fontWeight: 700 }}>G</div>
              <span className="flex-1 truncate">Google Calendar</span>
              {gcalConnected
                ? <CheckCircle2 size={11} style={{ color: "var(--success)" }} />
                : <span className="text-xs px-1.5 py-0.5 rounded-md" style={{ background: "var(--bg-surface)", color: "var(--text-muted)" }}>Connect</span>
              }
            </Link>
          </div>
        )}

        {/* User footer */}
        <div style={{ borderTop: "1px solid var(--border)" }}>
          {!sidebarCollapsed && (
            <div className="flex items-center gap-2.5 px-3 py-2.5">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold text-white shrink-0"
                style={{ background: "linear-gradient(145deg, #2a2a2a, #161616)" }}>
                {userName[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate leading-tight" style={{ color: "var(--text-primary)" }}>{userName}</p>
                <p className="text-xs truncate leading-tight" style={{ color: "var(--text-muted)" }}>{userEmail}</p>
              </div>
              <button onClick={logout} title="Sign out" className="p-1.5 rounded-lg transition-colors" style={{ color: "var(--text-secondary)" }}>
                <LogOut size={13} />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Space members modal */}
      {membersSpaceId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={() => setMembersSpaceId(null)}>
          <div className="rounded-2xl p-5 w-80 shadow-2xl" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-strong)" }}
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                  {spaces.find(s => s.id === membersSpaceId)?.icon} {spaces.find(s => s.id === membersSpaceId)?.name}
                </p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>Workspace members</p>
              </div>
              <button onClick={() => setMembersSpaceId(null)} className="p-1.5 rounded-lg transition-colors" style={{ color: "var(--text-secondary)" }}>
                <X size={14} />
              </button>
            </div>
            {membersLoading ? (
              <p className="text-xs text-center py-4" style={{ color: "var(--text-secondary)" }}>Loading…</p>
            ) : spaceMembers.length === 0 ? (
              <p className="text-xs text-center py-4" style={{ color: "var(--text-secondary)" }}>No members yet.</p>
            ) : (
              <div className="space-y-1.5">
                {spaceMembers.map((m) => (
                  <div key={m.id} className="flex items-center gap-3 px-3 py-2 rounded-xl" style={{ background: "var(--bg-surface)" }}>
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                      style={{ background: m.id === userId ? "#ffffff" : "#222222", color: m.id === userId ? "#000000" : "var(--text-primary)" }}>
                      {m.full_name?.[0]?.toUpperCase() ?? "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate" style={{ color: "var(--text-primary)" }}>
                        {m.full_name || "Unknown"}{m.id === userId ? " (you)" : ""}
                      </p>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full capitalize font-medium"
                      style={{
                        background: m.role === "admin" ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.05)",
                        color: m.role === "admin" ? "var(--text-primary)" : "var(--text-secondary)",
                      }}>
                      {m.role}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function ListRow({ list, active, onOpen, onDelete, onRename }: {
  list: List; active: boolean; onOpen: () => void; onDelete?: () => void; onRename?: () => void;
}) {
  return (
    <div className="group flex items-center rounded-lg transition-all duration-100"
      style={{ background: active ? "var(--bg-active)" : "transparent" }}>
      <button onClick={onOpen} className="flex items-center gap-2 flex-1 min-w-0 px-2 py-1.5 text-xs"
        style={{ color: active ? "#c4b5fd" : "var(--text-secondary)" }}>
        <span className="w-1.5 h-1.5 rounded-full shrink-0 flex-shrink-0" style={{ background: list.color }} />
        <span className="truncate font-medium"
          onDoubleClick={(e) => { e.stopPropagation(); onRename?.(); }}>
          {list.name}
        </span>
      </button>
      {onDelete && (
        <button onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity mr-1 shrink-0"
          style={{ color: "var(--danger)" }}>
          <Trash2 size={10} />
        </button>
      )}
    </div>
  );
}
