import { create } from "zustand";

export interface Toast {
  id: number;
  message: string;
  /** Optional action button, e.g. Undo */
  actionLabel?: string;
  onAction?: () => void | Promise<void>;
  type?: "success" | "error" | "info";
}

interface ToastState {
  toasts: Toast[];
  push: (t: Omit<Toast, "id">) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (t) => {
    const id = nextId++;
    set((s) => ({ toasts: [...s.toasts, { ...t, id }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) }));
    }, 6000);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}));

/** Convenience for non-React callers (stores, event handlers). */
export function toast(message: string, opts?: Omit<Toast, "id" | "message">) {
  useToastStore.getState().push({ message, ...opts });
}
