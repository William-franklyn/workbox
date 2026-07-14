import { create } from "zustand";

interface UIState {
  sidebarCollapsed: boolean;
  searchOpen: boolean;
  taskDetailOpen: boolean;
  notesOpen: boolean;
  userRole: string;
  toggleSidebar: () => void;
  setSidebarCollapsed: (v: boolean) => void;
  setSearchOpen: (v: boolean) => void;
  setTaskDetailOpen: (v: boolean) => void;
  toggleNotes: () => void;
  setNotesOpen: (v: boolean) => void;
  setUserRole: (role: string) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarCollapsed: false,
  searchOpen: false,
  taskDetailOpen: false,
  notesOpen: false,
  userRole: "member",
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
  setSearchOpen: (v) => set({ searchOpen: v }),
  setTaskDetailOpen: (v) => set({ taskDetailOpen: v }),
  toggleNotes: () => set((s) => ({ notesOpen: !s.notesOpen })),
  setNotesOpen: (v) => set({ notesOpen: v }),
  setUserRole: (role) => set({ userRole: role }),
}));
