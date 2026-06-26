import { create } from "zustand";

export interface Task {
  id: string;
  title: string;
  status: "todo" | "in_progress" | "in_review" | "done";
  priority: "urgent" | "high" | "normal" | "low";
  assignee?: string;
  due_date?: string;
  description?: string;
  list_id: string;
  position: number;
  tags: string[];
  created_at: string;
}

export interface List {
  id: string;
  name: string;
  folder_id?: string;
  space_id: string;
  color: string;
  position: number;
}

export interface Folder {
  id: string;
  name: string;
  space_id: string;
  expanded: boolean;
  lists: List[];
}

export interface Space {
  id: string;
  name: string;
  color: string;
  icon: string;
  expanded: boolean;
  folders: Folder[];
  lists: List[];
}

interface WorkspaceState {
  spaces: Space[];
  activeSpaceId: string | null;
  activeListId: string | null;
  selectedTaskId: string | null;
  view: "list" | "board" | "calendar" | "table" | "gantt";
  loaded: boolean;

  // Read
  loadSpaces: () => Promise<void>;

  // Write (optimistic + persist)
  setSpaces: (spaces: Space[]) => void;
  addSpace: (space: Space) => void;
  addList: (list: List, spaceId: string, folderId?: string) => void;
  addFolder: (folder: Folder, spaceId: string) => void;
  deleteSpace: (id: string) => void;
  deleteList: (id: string) => void;

  setActiveSpace: (id: string) => void;
  setActiveList: (id: string) => void;
  setSelectedTask: (id: string | null) => void;
  setView: (view: "list" | "board" | "calendar" | "table" | "gantt") => void;
  toggleSpaceExpanded: (id: string) => void;
  toggleFolderExpanded: (spaceId: string, folderId: string) => void;
}

async function saveToAPI(type: string, data: object) {
  await fetch("/api/workspace", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type, ...data }) });
}

async function deleteFromAPI(type: string, id: string) {
  await fetch("/api/workspace", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type, id }) });
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  spaces: [],
  activeSpaceId: null,
  activeListId: null,
  selectedTaskId: null,
  view: "list",
  loaded: false,

  loadSpaces: async () => {
    if (get().loaded) return;
    try {
      const res = await fetch("/api/workspace");
      if (!res.ok) return;
      const { spaces: rawSpaces, folders: rawFolders, lists: rawLists } = await res.json();

      if (rawSpaces.length === 0) {
        // First time — seed defaults
        const defaults: Space[] = [
          { id: `s${Date.now()}`, name: "Engineering", color: "#7c3aed", icon: "🚀", expanded: true, folders: [], lists: [{ id: `l${Date.now()}`, name: "Sprint 1", space_id: `s${Date.now()}`, color: "#7c3aed", position: 0 }] },
          { id: `s${Date.now()+1}`, name: "Marketing", color: "#f59e0b", icon: "📣", expanded: false, folders: [], lists: [] },
        ];
        // We'll save them when user interacts — just hydrate UI
        set({ spaces: defaults, loaded: true });
        return;
      }

      const spaces: Space[] = rawSpaces.map((s: any) => ({
        ...s,
        expanded: true,
        folders: rawFolders
          .filter((f: any) => f.space_id === s.id)
          .map((f: any) => ({
            ...f,
            expanded: false,
            lists: rawLists.filter((l: any) => l.folder_id === f.id),
          })),
        lists: rawLists.filter((l: any) => l.space_id === s.id && !l.folder_id),
      }));

      set({ spaces, loaded: true });
    } catch {
      set({ loaded: true });
    }
  },

  setSpaces: (spaces) => set({ spaces }),

  addSpace: (space) => {
    set((s) => ({ spaces: [...s.spaces, space] }));
    const { folders, lists, expanded, ...row } = space;
    saveToAPI("space", row);
  },

  addFolder: (folder, spaceId) => {
    set((s) => ({
      spaces: s.spaces.map((sp) =>
        sp.id === spaceId ? { ...sp, folders: [...sp.folders, folder] } : sp
      ),
    }));
    const { expanded, lists, ...row } = folder;
    saveToAPI("folder", row);
  },

  addList: (list, spaceId, folderId) => {
    set((s) => ({
      spaces: s.spaces.map((sp) => {
        if (sp.id !== spaceId) return sp;
        if (folderId) {
          return { ...sp, folders: sp.folders.map((f) => f.id === folderId ? { ...f, lists: [...f.lists, list] } : f) };
        }
        return { ...sp, lists: [...sp.lists, list] };
      }),
    }));
    saveToAPI("list", { ...list, space_id: spaceId, folder_id: folderId ?? null });
  },

  deleteSpace: (id) => {
    set((s) => ({ spaces: s.spaces.filter((sp) => sp.id !== id) }));
    deleteFromAPI("space", id);
  },

  deleteList: (id) => {
    set((s) => ({
      spaces: s.spaces.map((sp) => ({
        ...sp,
        lists: sp.lists.filter((l) => l.id !== id),
        folders: sp.folders.map((f) => ({ ...f, lists: f.lists.filter((l) => l.id !== id) })),
      })),
    }));
    deleteFromAPI("list", id);
  },

  setActiveSpace: (id) => set({ activeSpaceId: id }),
  setActiveList: (id) => set({ activeListId: id }),
  setSelectedTask: (id) => set({ selectedTaskId: id }),
  setView: (view) => set({ view }),

  toggleSpaceExpanded: (id) =>
    set((s) => ({ spaces: s.spaces.map((sp) => sp.id === id ? { ...sp, expanded: !sp.expanded } : sp) })),

  toggleFolderExpanded: (spaceId, folderId) =>
    set((s) => ({
      spaces: s.spaces.map((sp) =>
        sp.id === spaceId
          ? { ...sp, folders: sp.folders.map((f) => f.id === folderId ? { ...f, expanded: !f.expanded } : f) }
          : sp
      ),
    })),
}));
