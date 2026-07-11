"use client";
import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, Bell, StickyNote as StickyIcon, Camera, Loader2 } from "lucide-react";
import { toast } from "@/store/toast";

interface Note { id: string; content: string; color: string; x: number; y: number; remind_at: string | null; }

const COLORS: Record<string, { bg: string; text: string }> = {
  yellow: { bg: "#fef9c3", text: "#713f12" },
  pink:   { bg: "#fce7f3", text: "#831843" },
  blue:   { bg: "#dbeafe", text: "#1e3a8a" },
  green:  { bg: "#dcfce7", text: "#14532d" },
  purple: { bg: "#ede9fe", text: "#4c1d95" },
  orange: { bg: "#ffedd5", text: "#7c2d12" },
};

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [newColor, setNewColor] = useState("yellow");
  const boardRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: string; dx: number; dy: number } | null>(null);
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    fetch("/api/sticky-notes").then(r => r.json()).then(d => Array.isArray(d) && setNotes(d)).finally(() => setLoading(false));
  }, []);

  function patch(id: string, fields: Partial<Note>, debounce = false) {
    setNotes(ns => ns.map(n => n.id === id ? { ...n, ...fields } : n));
    const doSave = () => fetch("/api/sticky-notes", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, ...fields }) }).catch(() => {});
    if (debounce) {
      clearTimeout(saveTimers.current[id]);
      saveTimers.current[id] = setTimeout(doSave, 500);
    } else doSave();
  }

  async function addNote() {
    const board = boardRef.current?.getBoundingClientRect();
    const x = 40 + Math.round(Math.random() * 80), y = 40 + Math.round(Math.random() * 60);
    const res = await fetch("/api/sticky-notes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: "", color: newColor, x, y }) });
    if (res.ok) { const n = await res.json(); setNotes(ns => [...ns, n]); }
    void board;
  }

  async function del(id: string) {
    setNotes(ns => ns.filter(n => n.id !== id));
    await fetch("/api/sticky-notes", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
  }

  function onPointerDown(e: React.PointerEvent, n: Note) {
    if ((e.target as HTMLElement).tagName === "TEXTAREA" || (e.target as HTMLElement).closest("button")) return;
    const board = boardRef.current!.getBoundingClientRect();
    drag.current = { id: n.id, dx: e.clientX - board.left - n.x, dy: e.clientY - board.top - n.y };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current) return;
    const board = boardRef.current!.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - board.left - drag.current.dx, board.width - 180));
    const y = Math.max(0, Math.min(e.clientY - board.top - drag.current.dy, board.height - 120));
    setNotes(ns => ns.map(n => n.id === drag.current!.id ? { ...n, x, y } : n));
  }
  function onPointerUp() {
    if (!drag.current) return;
    const n = notes.find(x => x.id === drag.current!.id);
    if (n) patch(n.id, { x: n.x, y: n.y });
    drag.current = null;
  }

  async function screenshot() {
    const res = await fetch("/api/sticky-notes/image-link", { method: "POST" });
    const d = await res.json();
    if (!res.ok || !d.url) { toast(d.error ?? "Couldn't create image", { type: "error" }); return; }
    window.open(d.url, "_blank");
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-3 border-b shrink-0" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-2">
          <StickyIcon size={18} style={{ color: "var(--accent-purple)" }} />
          <h1 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>Sticky Notes</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 mr-1">
            {Object.entries(COLORS).map(([c, v]) => (
              <button key={c} onClick={() => setNewColor(c)} title={c}
                className="w-5 h-5 rounded-full transition-transform hover:scale-110"
                style={{ background: v.bg, boxShadow: newColor === c ? "0 0 0 2px var(--accent-purple)" : "0 0 0 1px var(--border)" }} />
            ))}
          </div>
          <button onClick={addNote} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white" style={{ background: "var(--accent-purple)" }}>
            <Plus size={14} /> Note
          </button>
          <button onClick={screenshot} title="Open a shareable image of your board" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
            <Camera size={14} /> Image
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center"><Loader2 size={20} className="animate-spin" style={{ color: "var(--text-secondary)" }} /></div>
      ) : (
        <div ref={boardRef} className="relative flex-1 overflow-hidden" style={{ background: "var(--bg-primary)" }}
          onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerLeave={onPointerUp}>
          {notes.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <StickyIcon size={36} className="opacity-20 mb-3" style={{ color: "var(--text-secondary)" }} />
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Pick a color and add your first note.</p>
            </div>
          )}
          {notes.map(n => {
            const c = COLORS[n.color] ?? COLORS.yellow;
            return (
              <div key={n.id} onPointerDown={e => onPointerDown(e, n)}
                className="absolute w-44 rounded-lg shadow-lg select-none"
                style={{ left: n.x, top: n.y, background: c.bg, cursor: "grab", touchAction: "none" }}>
                <div className="flex items-center justify-between px-2 pt-1.5">
                  <div className="flex gap-1">
                    {Object.entries(COLORS).map(([col, v]) => (
                      <button key={col} onClick={() => patch(n.id, { color: col })}
                        className="w-3 h-3 rounded-full" style={{ background: v.bg, boxShadow: n.color === col ? "0 0 0 1.5px " + c.text : "0 0 0 1px rgba(0,0,0,0.15)" }} />
                    ))}
                  </div>
                  <button onClick={() => del(n.id)} style={{ color: c.text, opacity: 0.6 }}><Trash2 size={12} /></button>
                </div>
                <textarea value={n.content} onChange={e => patch(n.id, { content: e.target.value }, true)}
                  placeholder="Write a reminder…" rows={4}
                  className="w-full bg-transparent outline-none resize-none px-3 py-2 text-sm leading-snug"
                  style={{ color: c.text }} />
                <div className="flex items-center gap-1 px-2 pb-1.5">
                  <Bell size={10} style={{ color: c.text, opacity: 0.6 }} />
                  <input type="datetime-local" value={n.remind_at ? n.remind_at.slice(0, 16) : ""}
                    onChange={e => patch(n.id, { remind_at: e.target.value ? new Date(e.target.value).toISOString() : null })}
                    className="bg-transparent outline-none text-[10px]" style={{ color: c.text, opacity: 0.75 }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
