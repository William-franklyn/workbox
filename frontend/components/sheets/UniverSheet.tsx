"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Download, Check } from "lucide-react";
import "@univerjs/presets/lib/styles/preset-sheets-core.css";

interface SheetRecord {
  id: string;
  name: string;
  col_headers: string[];
  row_data: string[][];
  workbook: Record<string, unknown> | null;
}

/** Convert the legacy headers+rows grid into a Univer workbook snapshot. */
function legacyToSnapshot(sheet: SheetRecord): Record<string, unknown> {
  const cellData: Record<number, Record<number, unknown>> = {};
  cellData[0] = {};
  (sheet.col_headers ?? []).forEach((h, c) => {
    cellData[0][c] = { v: h, s: { bl: 1 } };
  });
  (sheet.row_data ?? []).forEach((row, r) => {
    cellData[r + 1] = {};
    row.forEach((val, c) => {
      if (val !== "" && val != null) cellData[r + 1][c] = { v: val };
    });
  });
  return {
    id: sheet.id,
    name: sheet.name,
    sheetOrder: ["sheet-01"],
    sheets: {
      "sheet-01": {
        id: "sheet-01",
        name: "Sheet1",
        rowCount: Math.max((sheet.row_data?.length ?? 0) + 60, 120),
        columnCount: Math.max((sheet.col_headers?.length ?? 0) + 10, 26),
        cellData,
      },
    },
  };
}

/** Derive the legacy grid (headers + string rows) from a workbook snapshot. */
function snapshotToLegacy(snap: Record<string, unknown>): { col_headers: string[]; row_data: string[][] } {
  const sheets = (snap.sheets ?? {}) as Record<string, Record<string, unknown>>;
  const order = (snap.sheetOrder as string[]) ?? Object.keys(sheets);
  const first = sheets[order[0]];
  if (!first) return { col_headers: [], row_data: [] };
  const cellData = (first.cellData ?? {}) as Record<string, Record<string, { v?: unknown }>>;

  let maxRow = -1, maxCol = -1;
  for (const r of Object.keys(cellData)) {
    for (const c of Object.keys(cellData[r] ?? {})) {
      if (cellData[r][c]?.v !== undefined && cellData[r][c]?.v !== "") {
        maxRow = Math.max(maxRow, Number(r));
        maxCol = Math.max(maxCol, Number(c));
      }
    }
  }
  if (maxRow < 0) return { col_headers: [], row_data: [] };

  const readRow = (r: number) =>
    Array.from({ length: maxCol + 1 }, (_, c) => String(cellData[r]?.[c]?.v ?? ""));
  const col_headers = readRow(0);
  const row_data = Array.from({ length: maxRow }, (_, i) => readRow(i + 1));
  return { col_headers, row_data };
}

export default function UniverSheet({ sheet }: { sheet: SheetRecord }) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<{ getActiveWorkbook: () => { save: () => Record<string, unknown> } | null } | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [name, setName] = useState(sheet.name);
  const nameRef = useRef(sheet.name);
  const [editingName, setEditingName] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");

  useEffect(() => {
    let disposed = false;
    let univerInstance: { dispose: () => void } | null = null;
    let commandSub: { dispose: () => void } | null = null;

    (async () => {
      const [{ createUniver, LocaleType, merge }, corePreset, coreLocale] = await Promise.all([
        import("@univerjs/presets"),
        import("@univerjs/presets/preset-sheets-core"),
        import("@univerjs/presets/preset-sheets-core/locales/en-US"),
      ]);
      if (disposed || !containerRef.current) return;

      const { univer, univerAPI } = createUniver({
        locale: LocaleType.EN_US,
        locales: { [LocaleType.EN_US]: merge({}, coreLocale.default) },
        darkMode: true,
        presets: [corePreset.UniverSheetsCorePreset({ container: containerRef.current })],
      });
      univerInstance = univer;
      apiRef.current = univerAPI as unknown as typeof apiRef.current;

      univerAPI.createWorkbook(
        (sheet.workbook && Object.keys(sheet.workbook).length
          ? sheet.workbook
          : legacyToSnapshot(sheet)) as Parameters<typeof univerAPI.createWorkbook>[0],
      );

      // Autosave on real mutations (edits), not selection/viewport operations
      commandSub = univerAPI.onCommandExecuted((command: { id: string }) => {
        if (!command.id.includes(".mutation.")) return;
        scheduleSave();
      });
    })();

    return () => {
      disposed = true;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      commandSub?.dispose();
      univerInstance?.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheet.id]);

  function scheduleSave() {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setStatus("saving");
    saveTimer.current = setTimeout(persist, 1200);
  }

  async function persist() {
    const wb = apiRef.current?.getActiveWorkbook?.();
    if (!wb) return;
    const snapshot = wb.save();
    const legacy = snapshotToLegacy(snapshot);
    const res = await fetch("/api/spreadsheets", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: sheet.id, name: nameRef.current, workbook: snapshot, ...legacy }),
    }).catch(() => null);
    if (res?.ok) {
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 2000);
    } else {
      setStatus("idle");
    }
  }

  function updateName(val: string) {
    setName(val);
    nameRef.current = val;
    scheduleSave();
  }

  function exportCSV() {
    const wb = apiRef.current?.getActiveWorkbook?.();
    if (!wb) return;
    const { col_headers, row_data } = snapshotToLegacy(wb.save());
    const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const csv = [col_headers.map(esc).join(","), ...row_data.map(r => r.map(esc).join(","))].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url; a.download = `${nameRef.current}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b shrink-0"
        style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
        <button onClick={() => router.back()} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors shrink-0"
          style={{ color: "var(--text-secondary)" }}>
          <ArrowLeft size={16} />
        </button>

        {editingName ? (
          <input autoFocus value={name}
            onChange={e => updateName(e.target.value)}
            onBlur={() => setEditingName(false)}
            onKeyDown={e => { if (e.key === "Enter" || e.key === "Escape") setEditingName(false); }}
            className="flex-1 max-w-xs bg-transparent outline-none text-sm font-semibold border-b"
            style={{ color: "var(--text-primary)", borderColor: "var(--accent-purple)" }}
          />
        ) : (
          <span className="text-sm font-semibold cursor-pointer hover:opacity-70 transition-opacity"
            style={{ color: "var(--text-primary)" }}
            onDoubleClick={() => setEditingName(true)}>
            {name}
          </span>
        )}

        <div className="flex items-center gap-2 ml-auto">
          {status === "saving" && <span className="text-xs" style={{ color: "var(--text-secondary)" }}>Saving…</span>}
          {status === "saved" && (
            <span className="flex items-center gap-1 text-xs" style={{ color: "var(--success)" }}>
              <Check size={11} /> Saved
            </span>
          )}
          <button onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white hover:opacity-90 transition-opacity"
            style={{ background: "var(--accent-purple)" }}>
            <Download size={12} /> Export CSV
          </button>
        </div>
      </div>

      {/* Univer mounts here — it brings its own toolbar, formula bar, and grid */}
      <div ref={containerRef} className="flex-1 min-h-0" />
    </div>
  );
}
