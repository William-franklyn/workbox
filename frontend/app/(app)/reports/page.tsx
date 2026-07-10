"use client";
import { useEffect, useState } from "react";
import Papa from "papaparse";
import { BarChart3, Loader2, Upload, Sparkles } from "lucide-react";
import Chart, { ChartKind, summarize } from "@/components/charts/Chart";

type Source = "tasks" | "deals" | "budget" | "spreadsheet" | "csv" | "manual";

interface Series { labels: string[]; values: number[]; datasetLabel: string; }
interface Table { headers: string[]; rows: string[][]; }

const SOURCES: { id: Source; label: string }[] = [
  { id: "tasks", label: "Tasks by status" },
  { id: "deals", label: "CRM deals by stage" },
  { id: "budget", label: "Budget by category" },
  { id: "spreadsheet", label: "Spreadsheet" },
  { id: "csv", label: "Upload CSV" },
  { id: "manual", label: "Manual entry" },
];

const KINDS: { id: ChartKind; label: string }[] = [
  { id: "bar", label: "Bar" }, { id: "line", label: "Line" },
  { id: "doughnut", label: "Doughnut" }, { id: "polarArea", label: "Polar" },
];

/** Columns that are numeric in most rows are offered as value columns. */
function numericCols(t: Table): number[] {
  return t.headers.map((_, c) => c).filter(c => {
    const vals = t.rows.slice(0, 20).map(r => r[c]).filter(v => v != null && v !== "");
    if (!vals.length) return false;
    return vals.filter(v => !isNaN(Number(v))).length >= vals.length * 0.6;
  });
}

export default function ReportsPage() {
  const [source, setSource] = useState<Source>("tasks");
  const [kind, setKind] = useState<ChartKind>("bar");
  const [series, setSeries] = useState<Series | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showLegend, setShowLegend] = useState(true);
  const [fillArea, setFillArea] = useState(false);

  const [sheets, setSheets] = useState<{ id: string; name: string }[]>([]);
  const [sheetId, setSheetId] = useState("");

  // Column-mapping for tabular sources (spreadsheet / CSV)
  const [table, setTable] = useState<Table | null>(null);
  const [labelCol, setLabelCol] = useState(0);
  const [valueCol, setValueCol] = useState(1);
  const [rowLimit, setRowLimit] = useState(0); // 0 = all
  const [aggregate, setAggregate] = useState(false); // sum values per label

  const [manual, setManual] = useState("Q1, 120\nQ2, 210\nQ3, 175\nQ4, 260");
  const [insight, setInsight] = useState<string | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);

  useEffect(() => {
    if (source === "spreadsheet" && !sheets.length) {
      fetch("/api/spreadsheets").then(r => r.json()).then(d => Array.isArray(d) && setSheets(d)).catch(() => {});
    }
  }, [source, sheets.length]);

  async function loadSheet(id: string) {
    setSheetId(id); setSeries(null); setError(null);
    if (!id) { setTable(null); return; }
    const sheet = await fetch(`/api/spreadsheets?id=${id}`).then(r => r.json());
    const t: Table = { headers: sheet.col_headers ?? [], rows: sheet.row_data ?? [] };
    setTable(t);
    const nums = numericCols(t);
    setLabelCol(0);
    setValueCol(nums.find(c => c !== 0) ?? 1);
  }

  function onCsv(file: File) {
    Papa.parse(file, {
      complete: (res) => {
        const all = (res.data as string[][]).filter(r => r.some(c => c !== ""));
        if (!all.length) { setError("Empty CSV."); return; }
        // treat first row as headers if it's non-numeric
        const headerRow = all[0].every(c => isNaN(Number(c)) || c === "");
        const headers = headerRow ? all[0] : all[0].map((_, i) => `Column ${i + 1}`);
        const rows = headerRow ? all.slice(1) : all;
        const t: Table = { headers, rows };
        setTable(t); setSeries(null); setError(null);
        const nums = numericCols(t);
        setLabelCol(0);
        setValueCol(nums.find(c => c !== 0) ?? 1);
      },
      error: () => setError("Couldn't parse that CSV."),
    });
  }

  function buildFromTable(): Series {
    if (!table) throw new Error("No data loaded.");
    let rows = table.rows.filter(r => (r[labelCol] ?? "") !== "");
    if (aggregate) {
      const acc: Record<string, number> = {};
      for (const r of rows) acc[String(r[labelCol])] = (acc[String(r[labelCol])] ?? 0) + (Number(r[valueCol]) || 0);
      rows = Object.entries(acc).map(([k, v]) => { const a: string[] = []; a[labelCol] = k; a[valueCol] = String(v); return a; });
    }
    if (rowLimit > 0) rows = rows.slice(0, rowLimit);
    return {
      labels: rows.map(r => String(r[labelCol] ?? "")),
      values: rows.map(r => Number(r[valueCol]) || 0),
      datasetLabel: table.headers[valueCol] ?? "Value",
    };
  }

  async function build() {
    setLoading(true); setError(null); setInsight(null);
    try {
      let s: Series;
      if (source === "tasks") {
        const d = await fetch("/api/tasks/summary").then(r => r.json());
        s = { labels: ["To Do", "In Progress", "In Review", "Done"], values: [d.todo ?? 0, d.inProgress ?? 0, d.inReview ?? 0, d.done ?? 0], datasetLabel: "Tasks" };
      } else if (source === "deals") {
        const deals = await fetch("/api/crm?type=deals").then(r => r.json());
        const byStage: Record<string, number> = {};
        for (const dl of (deals ?? [])) byStage[dl.stage ?? "prospect"] = (byStage[dl.stage ?? "prospect"] ?? 0) + Number(dl.value ?? 0);
        s = { labels: Object.keys(byStage), values: Object.values(byStage), datasetLabel: "Deal value" };
      } else if (source === "budget") {
        const budgets = await fetch("/api/budget").then(r => r.json());
        if (!budgets?.length) throw new Error("No budgets yet — create one on the Budget page.");
        const items = await fetch(`/api/budget?budgetId=${budgets[0].id}`).then(r => r.json());
        s = { labels: (items ?? []).map((i: Record<string, string>) => i.category), values: (items ?? []).map((i: Record<string, number>) => Number(i.spent ?? 0)), datasetLabel: "Spent" };
      } else if (source === "spreadsheet" || source === "csv") {
        s = buildFromTable();
      } else {
        const parsed = manual.split("\n").map(l => l.split(",")).filter(p => p.length >= 2);
        s = { labels: parsed.map(p => p[0].trim()), values: parsed.map(p => Number(p[1]) || 0), datasetLabel: "Value" };
      }
      if (!s.labels.length) throw new Error("No data to chart from this selection.");
      setSeries(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to build chart");
      setSeries(null);
    } finally {
      setLoading(false);
    }
  }

  async function getInsight() {
    if (!series) return;
    setInsightLoading(true);
    const stats = summarize(series.values);
    const top = series.labels[series.values.indexOf(stats.max)];
    const prompt = `Here is a ${kind} chart of "${series.datasetLabel}". Categories and values: ${series.labels.map((l, i) => `${l}=${series.values[i]}`).join(", ")}. Total ${stats.total}, average ${stats.average.toFixed(1)}, highest is ${top} (${stats.max}). Give 2 short, specific insights a manager would care about. No preamble.`;
    try {
      const r = await fetch("/api/ai/insight", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt }) }).then(x => x.json());
      setInsight(r.text ?? "No insight available.");
    } catch {
      setInsight(`${top} leads with ${stats.max}. Average across ${series.labels.length} categories is ${stats.average.toFixed(1)}.`);
    } finally {
      setInsightLoading(false);
    }
  }

  const isTabular = source === "spreadsheet" || source === "csv";
  const selectCls = "px-3 py-1.5 rounded-lg text-xs";
  const selectStyle = { background: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" };

  return (
    <div className="p-6 max-w-4xl mx-auto overflow-y-auto h-full">
      <div className="flex items-center gap-2 mb-1">
        <BarChart3 size={20} style={{ color: "var(--accent-purple)" }} />
        <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Reports</h1>
      </div>
      <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>Turn your workspace data into charts — pick a source, choose the fields, visualize.</p>

      <div className="rounded-xl border p-4 mb-5" style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
        <label className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>Data source</label>
        <div className="flex flex-wrap gap-1.5 mt-1.5 mb-3">
          {SOURCES.map(s => (
            <button key={s.id} onClick={() => { setSource(s.id); setSeries(null); setTable(null); setError(null); }}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={{ background: source === s.id ? "var(--accent-purple)" : "var(--bg-surface)", color: source === s.id ? "#fff" : "var(--text-secondary)", border: "1px solid var(--border)" }}>
              {s.label}
            </button>
          ))}
        </div>

        {source === "spreadsheet" && (
          <select value={sheetId} onChange={e => loadSheet(e.target.value)} className={`${selectCls} mb-3`} style={selectStyle}>
            <option value="">Select spreadsheet…</option>
            {sheets.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}

        {source === "csv" && !table && (
          <label className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs cursor-pointer w-fit mb-3"
            style={{ background: "var(--bg-surface)", color: "var(--text-secondary)", border: "1px dashed var(--border-strong)" }}>
            <Upload size={13} /> Choose CSV
            <input type="file" accept=".csv" className="hidden" onChange={e => e.target.files?.[0] && onCsv(e.target.files[0])} />
          </label>
        )}

        {/* Field selection for tabular sources */}
        {isTabular && table && (
          <div className="rounded-lg border p-3 mb-3" style={{ borderColor: "var(--border)", background: "var(--bg-primary)" }}>
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--text-secondary)" }}>Choose fields to visualize</p>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>Labels</span>
              <select value={labelCol} onChange={e => setLabelCol(Number(e.target.value))} className={selectCls} style={selectStyle}>
                {table.headers.map((h, i) => <option key={i} value={i}>{h || `Column ${i + 1}`}</option>)}
              </select>
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>Values</span>
              <select value={valueCol} onChange={e => setValueCol(Number(e.target.value))} className={selectCls} style={selectStyle}>
                {table.headers.map((h, i) => <option key={i} value={i}>{h || `Column ${i + 1}`}</option>)}
              </select>
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>Top</span>
              <select value={rowLimit} onChange={e => setRowLimit(Number(e.target.value))} className={selectCls} style={selectStyle}>
                {[0, 5, 10, 15, 20].map(n => <option key={n} value={n}>{n === 0 ? "All rows" : n}</option>)}
              </select>
              <label className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-secondary)" }}>
                <input type="checkbox" checked={aggregate} onChange={e => setAggregate(e.target.checked)} /> Sum by label
              </label>
              {source === "csv" && <button onClick={() => { setTable(null); setSeries(null); }} className="text-xs ml-auto" style={{ color: "var(--accent-purple)" }}>Change file</button>}
            </div>
          </div>
        )}

        {source === "manual" && (
          <textarea value={manual} onChange={e => setManual(e.target.value)} rows={4}
            className="w-full px-3 py-2 rounded-lg text-xs font-mono mb-3 outline-none" style={selectStyle} placeholder={"Label, value\nQ1, 120"} />
        )}

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1.5">
            {KINDS.map(k => (
              <button key={k.id} onClick={() => setKind(k.id)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                style={{ background: kind === k.id ? "var(--accent-purple)" : "var(--bg-surface)", color: kind === k.id ? "#fff" : "var(--text-secondary)", border: "1px solid var(--border)" }}>
                {k.label}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-secondary)" }}>
            <input type="checkbox" checked={showLegend} onChange={e => setShowLegend(e.target.checked)} /> Legend
          </label>
          {kind === "line" && (
            <label className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-secondary)" }}>
              <input type="checkbox" checked={fillArea} onChange={e => setFillArea(e.target.checked)} /> Fill area
            </label>
          )}
          <button onClick={build} disabled={loading || (isTabular && !table)}
            className="ml-auto flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-50"
            style={{ background: "var(--accent-purple)" }}>
            {loading ? <Loader2 size={13} className="animate-spin" /> : <BarChart3 size={13} />} Visualize
          </button>
        </div>
      </div>

      {error && <p className="text-sm mb-4" style={{ color: "var(--danger)" }}>{error}</p>}

      {series && series.labels.length > 0 && (
        <div className="rounded-xl border p-5" style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
          <Chart kind={kind} labels={series.labels} values={series.values} datasetLabel={series.datasetLabel} showLegend={showLegend} fillArea={fillArea} />
          <div className="mt-4">
            <button onClick={getInsight} disabled={insightLoading}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg" style={{ border: "1px solid var(--border)", color: "var(--accent-purple)" }}>
              {insightLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} AI insight
            </button>
            {insight && <p className="text-sm mt-3 leading-relaxed" style={{ color: "var(--text-primary)" }}>{insight}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
