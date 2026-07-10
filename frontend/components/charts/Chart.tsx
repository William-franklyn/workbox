"use client";
import { useEffect, useMemo, useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, RadialLinearScale,
  BarElement, LineElement, PointElement, ArcElement,
  Title, Tooltip, Legend, Filler,
} from "chart.js";
import { Bar, Line, Doughnut, PolarArea } from "react-chartjs-2";

ChartJS.register(
  CategoryScale, LinearScale, RadialLinearScale,
  BarElement, LineElement, PointElement, ArcElement,
  Title, Tooltip, Legend, Filler,
);

export type ChartKind = "bar" | "line" | "doughnut" | "polarArea";

export interface ChartProps {
  kind: ChartKind;
  labels: string[];
  values: number[];
  datasetLabel?: string;
  /** customization (mirrors DataViz Studio's controls) */
  showLegend?: boolean;
  fillArea?: boolean;   // line
  tension?: number;     // line curve 0..1
  height?: number;
}

// Categorical palette — distinct, readable in light and dark (replaces the
// original library's random rgba colors so charts look intentional).
const PALETTE = ["#8b5cf6", "#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#ec4899", "#06b6d4", "#a3a3a3", "#14b8a6", "#f97316"];

function cssVar(name: string, fallback: string) {
  if (typeof window === "undefined") return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

export function summarize(values: number[]) {
  if (!values.length) return { total: 0, average: 0, max: 0, min: 0 };
  const total = values.reduce((s, v) => s + v, 0);
  return {
    total,
    average: total / values.length,
    max: Math.max(...values),
    min: Math.min(...values),
  };
}

const fmt = (n: number) => (Number.isInteger(n) ? n.toLocaleString() : n.toLocaleString(undefined, { maximumFractionDigits: 2 }));

export default function Chart({
  kind, labels, values, datasetLabel = "Value",
  showLegend = true, fillArea = false, tension = 0.3, height = 320,
}: ChartProps) {
  // Re-read theme colors when the light/dark theme flips
  const [themeTick, setThemeTick] = useState(0);
  useEffect(() => {
    const obs = new MutationObserver(() => setThemeTick(t => t + 1));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);

  const { data, options } = useMemo(() => {
    const text = cssVar("--text-secondary", "#9d9da8");
    const grid = cssVar("--border", "#242429");
    const single = PALETTE[0];
    const multi = labels.map((_, i) => PALETTE[i % PALETTE.length]);

    const isCategorical = kind === "doughnut" || kind === "polarArea";
    const bg = isCategorical ? multi : (kind === "line" ? single + "33" : single + "cc");
    const border = isCategorical ? multi : single;

    const data = {
      labels,
      datasets: [{
        label: datasetLabel,
        data: values,
        backgroundColor: bg,
        borderColor: border,
        borderWidth: kind === "line" ? 2 : 1,
        fill: kind === "line" ? fillArea : undefined,
        tension: kind === "line" ? tension : undefined,
        pointRadius: kind === "line" ? 3 : undefined,
      }],
    };

    const legend = { display: showLegend && (isCategorical || !!datasetLabel), position: "top" as const, labels: { color: text } };
    const scales = isCategorical ? undefined : {
      y: { beginAtZero: true, ticks: { color: text }, grid: { color: grid } },
      x: { ticks: { color: text }, grid: { color: grid } },
    };

    const options = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend, tooltip: { enabled: true } },
      ...(scales ? { scales } : {}),
    };
    return { data, options };
    // themeTick forces recompute on theme change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, labels, values, datasetLabel, showLegend, fillArea, tension, themeTick]);

  const stats = summarize(values);
  const ChartCmp = kind === "bar" ? Bar : kind === "line" ? Line : kind === "doughnut" ? Doughnut : PolarArea;

  return (
    <div>
      <div style={{ height }}>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <ChartCmp data={data as any} options={options as any} />
      </div>
      <div className="grid grid-cols-4 gap-2 mt-4">
        {([["Total", stats.total], ["Average", stats.average], ["Max", stats.max], ["Min", stats.min]] as const).map(([label, v]) => (
          <div key={label} className="rounded-lg border p-2.5 text-center" style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{label}</p>
            <p className="text-sm font-bold mt-0.5" style={{ color: "var(--text-primary)" }}>{fmt(v)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
