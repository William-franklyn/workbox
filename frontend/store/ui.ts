import { create } from "zustand";

interface UIState {
  sidebarCollapsed: boolean;
  searchOpen: boolean;
  taskDetailOpen: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (v: boolean) => void;
  setSearchOpen: (v: boolean) => void;
  setTaskDetailOpen: (v: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarCollapsed: false,
  searchOpen: false,
  taskDetailOpen: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
  setSearchOpen: (v) => set({ searchOpen: v }),
  setTaskDetailOpen: (v) => set({ taskDetailOpen: v }),
}));
