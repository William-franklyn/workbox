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
  view: "list" | "board" | "calendar" | "table";
  setActiveSpace: (id: string) => void;
  setActiveList: (id: string) => void;
  setSelectedTask: (id: string | null) => void;
  setView: (view: "list" | "board" | "calendar" | "table") => void;
  toggleSpaceExpanded: (id: string) => void;
  toggleFolderExpanded: (spaceId: string, folderId: string) => void;
  setSpaces: (spaces: Space[]) => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  spaces: [],
  activeSpaceId: null,
  activeListId: null,
  selectedTaskId: null,
  view: "list",
  setActiveSpace: (id) => set({ activeSpaceId: id }),
  setActiveList: (id) => set({ activeListId: id }),
  setSelectedTask: (id) => set({ selectedTaskId: id }),
  setView: (view) => set({ view }),
  toggleSpaceExpanded: (id) =>
    set((s) => ({
      spaces: s.spaces.map((sp) =>
        sp.id === id ? { ...sp, expanded: !sp.expanded } : sp
      ),
    })),
  toggleFolderExpanded: (spaceId, folderId) =>
    set((s) => ({
      spaces: s.spaces.map((sp) =>
        sp.id === spaceId
          ? {
              ...sp,
              folders: sp.folders.map((f) =>
                f.id === folderId ? { ...f, expanded: !f.expanded } : f
              ),
            }
          : sp
      ),
    })),
  setSpaces: (spaces) => set({ spaces }),
}));
