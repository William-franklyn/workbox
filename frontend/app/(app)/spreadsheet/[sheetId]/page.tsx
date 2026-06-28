"use client";
import { use, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Download, Plus, Trash2, Loader2, Check } from "lucide-react";

interface Sheet {
  id: string;
  folder_id: string;
  name: string;
  col_headers: string[];
  row_data: string[][];
  updated_at: string;
}

function cellKey(r: number, c: number) { return `${r}-${c}`; }

export default function SpreadsheetPage({ params }: { params: Promise<{ sheetId: string }> }) {
  const { sheetId } = use(params);
  const router = useRouter();
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [cols, setCols] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [name, setName] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const cellRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`/api/spreadsheets?id=${sheetId}`)
      .then(r => r.json())
      .then((d: Sheet) => {
        setSheet(d);
        setName(d.name);
        setCols(d.col_headers ?? []);
        setRows(d.row_data ?? []);
        setLoading(false);
      });
  }, [sheetId]);

  const scheduleSave = useCallback((c: string[], r: string[][], n: string) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaved(false);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      await fetch("/api/spreadsheets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: sheetId, col_headers: c, row_data: r, name: n }),
      });
      setSaving(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }, 800);
  }, [sheetId]);

  function updateCell(rowIdx: number, colIdx: number, value: string) {
    const next = rows.map((r, ri) => ri === rowIdx ? r.map((c, ci) => ci === colIdx ? value : c) : r);
    setRows(next);
    scheduleSave(cols, next, name);
  }

  function updateCol(colIdx: number, value: string) {
    const next = cols.map((c, i) => i === colIdx ? value : c);
    setCols(next);
    scheduleSave(next, rows, name);
  }

  function updateName(val: string) {
    setName(val);
    scheduleSave(cols, rows, val);
  }

  function addRow() {
    const next = [...rows, Array(cols.length).fill("")];
    setRows(next);
    scheduleSave(cols, next, name);
    setTimeout(() => cellRefs.current[cellKey(next.length - 1, 0)]?.focus(), 30);
  }

  function deleteRow(idx: number) {
    const next = rows.filter((_, i) => i !== idx);
    setRows(next);
    scheduleSave(cols, next, name);
  }

  function addCol() {
    const nextCols = [...cols, String.fromCharCode(65 + cols.length)];
    const nextRows = rows.map(r => [...r, ""]);
    setCols(nextCols);
    setRows(nextRows);
    scheduleSave(nextCols, nextRows, name);
  }

  function deleteCol(idx: number) {
    const nextCols = cols.filter((_, i) => i !== idx);
    const nextRows = rows.map(r => r.filter((_, i) => i !== idx));
    setCols(nextCols);
    setRows(nextRows);
    scheduleSave(nextCols, nextRows, name);
  }

  function handleCellKey(e: React.KeyboardEvent<HTMLInputElement>, ri: number, ci: number) {
    if (e.key === "Tab") {
      e.preventDefault();
      if (ci + 1 < cols.length) {
        cellRefs.current[cellKey(ri, ci + 1)]?.focus();
      } else if (ri + 1 < rows.length) {
        cellRefs.current[cellKey(ri + 1, 0)]?.focus();
      } else {
        addRow();
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (ri + 1 < rows.length) {
        cellRefs.current[cellKey(ri + 1, ci)]?.focus();
      } else {
        addRow();
      }
    } else if (e.key === "ArrowUp" && ri > 0) {
      e.preventDefault();
      cellRefs.current[cellKey(ri - 1, ci)]?.focus();
    } else if (e.key === "ArrowDown" && ri + 1 < rows.length) {
      e.preventDefault();
      cellRefs.current[cellKey(ri + 1, ci)]?.focus();
    }
  }

  function exportCSV() {
    const csvRows = [
      cols.map(c => `"${c.replace(/"/g, '""')}"`).join(","),
      ...rows.map(r => (r.length ? r : Array(cols.length).fill("")).map(c => `"${(c ?? "").replace(/"/g, '""')}"`).join(",")),
    ];
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${name}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 size={22} className="animate-spin" style={{ color: "var(--text-secondary)" }} />
      </div>
    );
  }

  if (!sheet) {
    return <div className="flex items-center justify-center h-full text-sm" style={{ color: "var(--text-secondary)" }}>Spreadsheet not found.</div>;
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b shrink-0"
        style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
        <button onClick={() => router.back()} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors shrink-0"
          style={{ color: "var(--text-secondary)" }}>
          <ArrowLeft size={16} />
        </button>

        {/* Editable name */}
        {editingName ? (
          <input ref={nameRef} value={name}
            onChange={e => updateName(e.target.value)}
            onBlur={() => setEditingName(false)}
            onKeyDown={e => { if (e.key === "Enter" || e.key === "Escape") setEditingName(false); }}
            className="flex-1 max-w-xs bg-transparent outline-none text-sm font-semibold border-b"
            style={{ color: "var(--text-primary)", borderColor: "var(--accent-purple)" }}
          />
        ) : (
          <span className="text-sm font-semibold cursor-pointer hover:opacity-70 transition-opacity"
            style={{ color: "var(--text-primary)" }}
            onDoubleClick={() => { setEditingName(true); setTimeout(() => nameRef.current?.select(), 10); }}>
            {name}
          </span>
        )}

        <div className="flex items-center gap-1.5 ml-auto">
          {saving && <span className="text-xs" style={{ color: "var(--text-secondary)" }}>Saving…</span>}
          {saved && (
            <span className="flex items-center gap-1 text-xs" style={{ color: "#22c55e" }}>
              <Check size={11} /> Saved
            </span>
          )}
          <button onClick={addCol}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs hover:bg-white/5 transition-colors"
            style={{ color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
            <Plus size={12} /> Col
          </button>
          <button onClick={addRow}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs hover:bg-white/5 transition-colors"
            style={{ color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
            <Plus size={12} /> Row
          </button>
          <button onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white hover:opacity-90 transition-opacity"
            style={{ background: "var(--accent-purple)" }}>
            <Download size={12} /> Export CSV
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-auto">
        <table className="border-collapse" style={{ minWidth: "100%" }}>
          <thead className="sticky top-0 z-10" style={{ background: "var(--bg-secondary)" }}>
            <tr>
              {/* Row number header */}
              <th className="w-10 border-r border-b text-center text-xs select-none"
                style={{ borderColor: "var(--border)", color: "var(--text-secondary)", minWidth: 40 }} />

              {cols.map((col, ci) => (
                <th key={ci} className="border-r border-b group relative"
                  style={{ borderColor: "var(--border)", minWidth: 120 }}>
                  <div className="flex items-center">
                    <input
                      value={col}
                      onChange={e => updateCol(ci, e.target.value)}
                      className="flex-1 px-3 py-2 text-xs font-semibold bg-transparent outline-none uppercase tracking-wide text-center"
                      style={{ color: "var(--text-secondary)" }}
                    />
                    {cols.length > 1 && (
                      <button onClick={() => deleteCol(ci)}
                        className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded"
                        style={{ color: "var(--danger)" }}>
                        <Trash2 size={10} />
                      </button>
                    )}
                  </div>
                </th>
              ))}
              <th className="w-8 border-b" style={{ borderColor: "var(--border)" }}>
                <button onClick={addCol} className="w-full h-full flex items-center justify-center hover:bg-white/5 py-2"
                  style={{ color: "var(--text-secondary)" }}>
                  <Plus size={13} />
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} className="group/row hover:bg-white/2 transition-colors">
                {/* Row number */}
                <td className="text-center text-xs border-r border-b select-none w-10 relative"
                  style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
                  <span className="group-hover/row:hidden">{ri + 1}</span>
                  <button onClick={() => deleteRow(ri)}
                    className="hidden group-hover/row:flex items-center justify-center w-full h-full absolute inset-0"
                    style={{ color: "var(--danger)" }}>
                    <Trash2 size={11} />
                  </button>
                </td>

                {cols.map((_, ci) => (
                  <td key={ci} className="border-r border-b p-0" style={{ borderColor: "var(--border)" }}>
                    <input
                      ref={el => { cellRefs.current[cellKey(ri, ci)] = el; }}
                      value={row[ci] ?? ""}
                      onChange={e => updateCell(ri, ci, e.target.value)}
                      onKeyDown={e => handleCellKey(e, ri, ci)}
                      className="w-full px-3 py-2 text-sm bg-transparent outline-none"
                      style={{
                        color: "var(--text-primary)",
                        minWidth: 120,
                      }}
                      onFocus={e => (e.currentTarget.parentElement!.style.outline = "2px solid var(--accent-purple)")}
                      onBlur={e => (e.currentTarget.parentElement!.style.outline = "none")}
                    />
                  </td>
                ))}
                <td className="border-b w-8" style={{ borderColor: "var(--border)" }} />
              </tr>
            ))}

            {/* Add row */}
            <tr>
              <td colSpan={cols.length + 2} className="border-b" style={{ borderColor: "var(--border)" }}>
                <button onClick={addRow}
                  className="w-full flex items-center gap-2 px-4 py-2 text-xs hover:bg-white/3 transition-colors"
                  style={{ color: "var(--text-secondary)" }}>
                  <Plus size={12} /> Add row
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="px-4 py-2 border-t text-xs shrink-0" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
        {rows.length} rows · {cols.length} columns · Double-click the title to rename · Tab/Enter to navigate cells
      </div>
    </div>
  );
}
