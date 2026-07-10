"use client";
import { useEffect, useState } from "react";
import Papa from "papaparse";
import { BarChart3, Loader2, Upload, Sparkles } from "lucide-react";
import Chart, { ChartKind, summarize } from "@/components/charts/Chart";

type Source = "tasks" | "deals" | "budget" | "spreadsheet" | "csv" | "manual";

interface Series { labels: string[]; values: number[]; datasetLabel: string; }

const SOURCES: { id: Source; label: string }[] = [
  { id: "tasks", label: "Tasks by status" },
  { id: "deals", label: "CRM deals by stage" },
  { id: "budget", label: "Budget by category" },
  { id: "spreadsheet", label: "Spreadsheet column" },
  { id: "csv", label: "Upload CSV" },
  { id: "manual", label: "Manual entry" },
];

const KINDS: { id: ChartKind; label: string }[] = [
  { id: "bar", label: "Bar" },
  { id: "line", label: "Line" },
  { id: "doughnut", label: "Doughnut" },
  { id: "polarArea", label: "Polar" },
];

export default function ReportsPage() {
  const [source, setSource] = useState<Source>("tasks");
  const [kind, setKind] = useState<ChartKind>("bar");
  const [series, setSeries] = useState<Series | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // options
  const [showLegend, setShowLegend] = useState(true);
  const [fillArea, setFillArea] = useState(false);

  // spreadsheet picker state
  const [sheets, setSheets] = useState<{ id: string; name: string }[]>([]);
  const [sheetId, setSheetId] = useState("");
  const [sheetCols, setSheetCols] = useState<string[]>([]);
  const [valueCol, setValueCol] = useState(1);

  // manual
  const [manual, setManual] = useState("Q1, 120\nQ2, 210\nQ3, 175\nQ4, 260");

  // AI insight
  const [insight, setInsight] = useState<string | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);

  useEffect(() => {
    if (source === "spreadsheet" && !sheets.length) {
      fetch("/api/spreadsheets").then(r => r.json()).then(d => Array.isArray(d) && setSheets(d)).catch(() => {});
    }
  }, [source, sheets.length]);

  async function build() {
    setLoading(true); setError(null); setInsight(null);
    try {
      let s: Series | null = null;
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
      } else if (source === "spreadsheet") {
        if (!sheetId) throw new Error("Pick a spreadsheet.");
        const sheet = await fetch(`/api/spreadsheets?id=${sheetId}`).then(r => r.json());
        const headers: string[] = sheet.col_headers ?? [];
        const rows: string[][] = sheet.row_data ?? [];
        setSheetCols(headers);
        s = {
          labels: rows.map(r => r[0] ?? ""),
          values: rows.map(r => Number(r[valueCol]) || 0),
          datasetLabel: headers[valueCol] ?? "Value",
        };
      } else if (source === "manual") {
        const parsed = manual.split("\n").map(l => l.split(",")).filter(p => p.length >= 2);
        s = { labels: parsed.map(p => p[0].trim()), values: parsed.map(p => Number(p[1]) || 0), datasetLabel: "Value" };
      }
      if (s && s.labels.length === 0) throw new Error("No data to chart from this source yet.");
      setSeries(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to build chart");
      setSeries(null);
    } finally {
      setLoading(false);
    }
  }

  function onCsv(file: File) {
    Papa.parse(file, {
      complete: (res) => {
        const rows = (res.data as string[][]).filter(r => r.length >= 2 && r[0]);
        // skip header row if second col isn't numeric
        const start = rows.length && isNaN(Number(rows[0][1])) ? 1 : 0;
        const body = rows.slice(start);
        setSeries({ labels: body.map(r => r[0]), values: body.map(r => Number(r[1]) || 0), datasetLabel: "Value" });
        setError(null);
      },
      error: () => setError("Couldn't parse that CSV."),
    });
  }

  async function getInsight() {
    if (!series) return;
    setInsightLoading(true);
    const stats = summarize(series.values);
    const top = series.labels[series.values.indexOf(stats.max)];
    const prompt = `Here is a ${kind} chart of "${series.datasetLabel}". Categories and values: ${series.labels.map((l, i) => `${l}=${series.values[i]}`).join(", ")}. Total ${stats.total}, average ${stats.average.toFixed(1)}, highest is ${top} (${stats.max}). Give 2 short, specific insights a manager would care about. No preamble.`;
    try {
      const r = await fetch("/api/ai/insight", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt }) }).then(x => x.json());
      setInsight(r.text ?? r.insight ?? "No insight available.");
    } catch {
      setInsight(`${top} leads with ${stats.max}. Average across ${series.labels.length} categories is ${stats.average.toFixed(1)}.`);
    } finally {
      setInsightLoading(false);
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto overflow-y-auto h-full">
      <div className="flex items-center gap-2 mb-1">
        <BarChart3 size={20} style={{ color: "var(--accent-purple)" }} />
        <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Reports</h1>
      </div>
      <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>Turn your workspace data into charts.</p>

      <div className="rounded-xl border p-4 mb-5" style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
        {/* Data source */}
        <label className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>Data source</label>
        <div className="flex flex-wrap gap-1.5 mt-1.5 mb-3">
          {SOURCES.map(s => (
            <button key={s.id} onClick={() => { setSource(s.id); setSeries(null); }}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={{ background: source === s.id ? "var(--accent-purple)" : "var(--bg-surface)", color: source === s.id ? "#fff" : "var(--text-secondary)", border: "1px solid var(--border)" }}>
              {s.label}
            </button>
          ))}
        </div>

        {source === "spreadsheet" && (
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <select value={sheetId} onChange={e => setSheetId(e.target.value)}
              className="px-3 py-1.5 rounded-lg text-xs" style={{ background: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }}>
              <option value="">Select spreadsheet…</option>
              {sheets.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            {sheetCols.length > 1 && (
              <select value={valueCol} onChange={e => setValueCol(Number(e.target.value))}
                className="px-3 py-1.5 rounded-lg text-xs" style={{ background: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }}>
                {sheetCols.map((c, i) => i > 0 && <option key={i} value={i}>Values: {c}</option>)}
              </select>
            )}
          </div>
        )}

        {source === "csv" && (
          <label className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs cursor-pointer w-fit mb-3"
            style={{ background: "var(--bg-surface)", color: "var(--text-secondary)", border: "1px dashed var(--border-strong)" }}>
            <Upload size={13} /> Choose CSV (first column = labels, second = numbers)
            <input type="file" accept=".csv" className="hidden" onChange={e => e.target.files?.[0] && onCsv(e.target.files[0])} />
          </label>
        )}

        {source === "manual" && (
          <textarea value={manual} onChange={e => setManual(e.target.value)} rows={4}
            className="w-full px-3 py-2 rounded-lg text-xs font-mono mb-3 outline-none"
            style={{ background: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
            placeholder={"Label, value\nQ1, 120"} />
        )}

        {/* Chart type + options */}
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
          {source !== "csv" && (
            <button onClick={build} disabled={loading}
              className="ml-auto flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-60"
              style={{ background: "var(--accent-purple)" }}>
              {loading ? <Loader2 size={13} className="animate-spin" /> : <BarChart3 size={13} />} Visualize
            </button>
          )}
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
