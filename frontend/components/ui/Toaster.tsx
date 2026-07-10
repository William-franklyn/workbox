"use client";
import { useToastStore } from "@/store/toast";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

const ICONS = {
  success: <CheckCircle2 size={15} style={{ color: "#22c55e" }} />,
  error: <AlertCircle size={15} style={{ color: "#ef4444" }} />,
  info: <Info size={15} style={{ color: "var(--accent-purple)" }} />,
};

export default function Toaster() {
  const { toasts, dismiss } = useToastStore();
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 items-center pointer-events-none">
      {toasts.map((t) => (
        <div key={t.id}
          className="pointer-events-auto flex items-center gap-3 pl-4 pr-2 py-2.5 rounded-xl shadow-2xl border text-sm animate-in fade-in slide-in-from-bottom-2"
          style={{ background: "var(--bg-secondary)", borderColor: "var(--border)", color: "var(--text-primary)" }}>
          {ICONS[t.type ?? "success"]}
          <span>{t.message}</span>
          {t.actionLabel && (
            <button
              onClick={async () => { await t.onAction?.(); dismiss(t.id); }}
              className="text-xs font-semibold px-2.5 py-1 rounded-lg hover:bg-white/10"
              style={{ background: "rgba(124,58,237,0.15)", color: "var(--accent-purple)" }}>
              {t.actionLabel}
            </button>
          )}
          <button onClick={() => dismiss(t.id)} className="p-1 rounded hover:bg-white/10"
            style={{ color: "var(--text-secondary)" }}>
            <X size={13} />
          </button>
        </div>
      ))}
    </div>
  );
}
