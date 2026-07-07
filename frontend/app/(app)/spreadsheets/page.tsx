"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Table2, Loader2, Trash2, Clock } from "lucide-react";

interface Sheet {
  id: string;
  name: string;
  col_headers: string[];
  created_at: string;
  updated_at: string;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  if (d < 7) return `${d}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function SpreadsheetsPage() {
  const router = useRouter();
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetch("/api/spreadsheets")
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setSheets(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function createSheet() {
    setCreating(true);
    try {
      const res = await fetch("/api/spreadsheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Untitled Spreadsheet" }),
      });
      const data = await res.json();
      if (data.id) router.push(`/spreadsheet/${data.id}`);
    } catch {
      setCreating(false);
    }
  }

  async function deleteSheet(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    await fetch("/api/spreadsheets", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setSheets(prev => prev.filter(s => s.id !== id));
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(124,58,237,0.15)" }}>
              <Table2 size={18} style={{ color: "var(--accent-purple)" }} />
            </div>
            <div>
              <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Spreadsheets</h1>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Tables, budgets, and data grids</p>
            </div>
          </div>
          <button
            onClick={createSheet}
            disabled={creating}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{ background: "var(--accent-purple)", color: "white" }}
          >
            {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            New spreadsheet
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 size={24} className="animate-spin" style={{ color: "var(--text-secondary)" }} />
          </div>
        ) : sheets.length === 0 ? (
          <div className="rounded-2xl border flex flex-col items-center justify-center py-24 px-8 text-center"
            style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: "rgba(124,58,237,0.1)" }}>
              <Table2 size={28} style={{ color: "var(--accent-purple)", opacity: 0.6 }} />
            </div>
            <h3 className="text-base font-semibold mb-2" style={{ color: "var(--text-primary)" }}>No spreadsheets yet</h3>
            <p className="text-sm mb-6 max-w-xs" style={{ color: "var(--text-secondary)" }}>
              Create your first spreadsheet to track data, budgets, and more.
            </p>
            <button onClick={createSheet} disabled={creating}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-opacity hover:opacity-90"
              style={{ background: "var(--accent-purple)", color: "white" }}>
              {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Create spreadsheet
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {sheets.map(sheet => (
              <button
                key={sheet.id}
                onClick={() => router.push(`/spreadsheet/${sheet.id}`)}
                className="relative group rounded-xl border text-left p-4 transition-all hover:border-purple-500/30"
                style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: "rgba(34,197,94,0.12)" }}>
                    <Table2 size={16} style={{ color: "#22c55e" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>{sheet.name}</p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                      {sheet.col_headers?.length ?? 0} columns
                    </p>
                    <div className="flex items-center gap-1 mt-1.5">
                      <Clock size={10} style={{ color: "var(--text-muted)" }} />
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>{timeAgo(sheet.updated_at)}</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={e => deleteSheet(e, sheet.id)}
                  className="absolute top-3 right-3 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/10"
                  style={{ color: "var(--text-muted)" }}
                >
                  <Trash2 size={12} />
                </button>
              </button>
            ))}

            {/* New sheet card */}
            <button
              onClick={createSheet}
              disabled={creating}
              className="rounded-xl border border-dashed text-left p-4 flex items-center gap-3 transition-colors hover:border-white/20 disabled:opacity-60"
              style={{ borderColor: "var(--border)" }}
            >
              <div className="w-9 h-9 rounded-lg border-2 border-dashed flex items-center justify-center flex-shrink-0"
                style={{ borderColor: "var(--border-strong)" }}>
                {creating ? <Loader2 size={14} className="animate-spin" style={{ color: "var(--text-muted)" }} /> : <Plus size={14} style={{ color: "var(--text-muted)" }} />}
              </div>
              <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>New spreadsheet</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
