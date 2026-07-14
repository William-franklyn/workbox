"use client";
import { useEffect, useRef, useState } from "react";
import { useUIStore } from "@/store/ui";
import { X, Plus } from "lucide-react";

// Self-contained palette (avoids importing the Node-only render module).
const COLORS: Record<string, { bg: string; text: string; bar: string }> = {
  yellow: { bg: "#fef9c3", text: "#713f12", bar: "#eab308" },
  pink:   { bg: "#fce7f3", text: "#831843", bar: "#ec4899" },
  blue:   { bg: "#dbeafe", text: "#1e3a8a", bar: "#3b82f6" },
  green:  { bg: "#dcfce7", text: "#14532d", bar: "#22c55e" },
  purple: { bg: "#ede9fe", text: "#4c1d95", bar: "#8b5cf6" },
  orange: { bg: "#ffedd5", text: "#7c2d12", bar: "#f97316" },
};
const ORDER = ["yellow", "pink", "blue", "green", "purple", "orange"];

interface Note { id: string; content: string; color: string; x: number; y: number }

const W = 208;

/**
 * A global floating sticky-notes layer that overlays the whole app. Notes can
 * be dragged anywhere and their position persists (per user) via the existing
 * /api/sticky-notes endpoint. Toggled from the top bar (notesOpen in the UI
 * store). The overlay is click-through except on the notes themselves.
 */
export default function FloatingNotes() {
  const { notesOpen } = useUIStore();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loaded, setLoaded] = useState(false);
  const drag = useRef<{ id: string; dx: number; dy: number } | null>(null);

  useEffect(() => {
    if (!notesOpen || loaded) return;
    fetch("/api/sticky-notes")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d)) {
          setNotes(d.map((n) => ({ id: n.id, content: n.content ?? "", color: n.color ?? "yellow", x: n.x ?? 40, y: n.y ?? 96 })));
        }
      })
      .finally(() => setLoaded(true));
  }, [notesOpen, loaded]);

  function patch(id: string, body: Partial<Note>) {
    fetch("/api/sticky-notes", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, ...body }) }).catch(() => {});
  }

  async function addNote() {
    const x = Math.round(window.innerWidth / 2 - W / 2 + (Math.random() * 80 - 40));
    const y = Math.round(120 + Math.random() * 80);
    try {
      const res = await fetch("/api/sticky-notes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: "", color: "yellow", x, y }) });
      const n = await res.json();
      if (n?.id) setNotes((ns) => [...ns, { id: n.id, content: "", color: "yellow", x, y }]);
    } catch {}
  }

  function remove(id: string) {
    setNotes((ns) => ns.filter((n) => n.id !== id));
    fetch("/api/sticky-notes", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) }).catch(() => {});
  }

  function cycleColor(id: string) {
    setNotes((ns) => ns.map((n) => {
      if (n.id !== id) return n;
      const next = ORDER[(ORDER.indexOf(n.color) + 1) % ORDER.length];
      patch(id, { color: next });
      return { ...n, color: next };
    }));
  }

  function onMove(e: React.PointerEvent) {
    if (!drag.current) return;
    const { id, dx, dy } = drag.current;
    const x = Math.max(4, Math.min(e.clientX - dx, window.innerWidth - W - 4));
    const y = Math.max(56, Math.min(e.clientY - dy, window.innerHeight - 60));
    setNotes((ns) => ns.map((n) => (n.id === id ? { ...n, x, y } : n)));
  }
  function onUp(e: React.PointerEvent) {
    if (!drag.current) return;
    const { id } = drag.current;
    drag.current = null;
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
    const n = notes.find((x) => x.id === id);
    if (n) patch(id, { x: n.x, y: n.y });
  }

  if (!notesOpen) return null;

  return (
    <div className="fixed inset-0 z-40 pointer-events-none">
      {notes.map((n) => {
        const c = COLORS[n.color] ?? COLORS.yellow;
        return (
          <div
            key={n.id}
            className="absolute pointer-events-auto rounded-lg flex flex-col overflow-hidden"
            style={{ left: n.x, top: n.y, width: W, minHeight: 132, background: c.bg, boxShadow: "0 10px 28px rgba(0,0,0,0.28)" }}
          >
            <div
              onPointerDown={(e) => { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); drag.current = { id: n.id, dx: e.clientX - n.x, dy: e.clientY - n.y }; }}
              onPointerMove={onMove}
              onPointerUp={onUp}
              className="flex items-center justify-between px-2 py-1.5 cursor-grab active:cursor-grabbing touch-none"
              style={{ background: c.bar }}
            >
              <button onClick={() => cycleColor(n.id)} title="Change colour" className="w-4 h-4 rounded-full shrink-0" style={{ background: c.bg, border: "1px solid rgba(0,0,0,0.2)" }} />
              <button onClick={() => remove(n.id)} title="Delete note" className="opacity-70 hover:opacity-100" style={{ color: "#1f2937" }}>
                <X size={14} />
              </button>
            </div>
            <textarea
              value={n.content}
              onChange={(e) => setNotes((ns) => ns.map((x) => (x.id === n.id ? { ...x, content: e.target.value } : x)))}
              onBlur={(e) => patch(n.id, { content: e.target.value })}
              placeholder="Write a note…"
              className="flex-1 bg-transparent outline-none resize-none px-3 py-2 text-sm leading-snug"
              style={{ color: c.text, minHeight: 92 }}
            />
          </div>
        );
      })}

      {/* Add-note pill, centred under the top bar */}
      <button
        onClick={addNote}
        className="pointer-events-auto fixed left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-4 py-2 rounded-full text-white text-sm font-medium shadow-lg"
        style={{ top: 60, background: "var(--accent-purple)", boxShadow: "0 8px 22px rgba(124,58,237,0.4)" }}
      >
        <Plus size={15} /> Add note
      </button>
    </div>
  );
}
