// Server-side chart images via QuickChart.io — renders a Chart.js config to a
// PNG on demand. We POST to /chart/create to get a short, WhatsApp-friendly
// image URL. Nothing is persisted on our side; the image is generated when the
// URL is fetched and is not stored in WorkBox.

const PALETTE = ["#8b5cf6", "#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#ec4899", "#06b6d4", "#a3a3a3", "#14b8a6", "#f97316"];

export type ChartKind = "bar" | "line" | "doughnut" | "polarArea" | "pie";

export function buildChartConfig(params: {
  kind: ChartKind; labels: string[]; values: number[]; title?: string; datasetLabel?: string;
}) {
  const categorical = params.kind === "doughnut" || params.kind === "polarArea" || params.kind === "pie";
  const colors = params.labels.map((_, i) => PALETTE[i % PALETTE.length]);
  return {
    type: params.kind,
    data: {
      labels: params.labels,
      datasets: [{
        label: params.datasetLabel ?? "Value",
        data: params.values,
        backgroundColor: categorical ? colors : PALETTE[0],
        borderColor: categorical ? colors : PALETTE[0],
        borderWidth: 1,
        fill: params.kind === "line" ? false : undefined,
      }],
    },
    options: {
      plugins: {
        title: { display: !!params.title, text: params.title ?? "" },
        legend: { display: categorical },
      },
      scales: categorical ? {} : { y: { beginAtZero: true } },
    },
  };
}

/** Returns a short public image URL (PNG) for the given chart config, or null. */
export async function chartImageUrl(config: object, width = 640, height = 400): Promise<string | null> {
  try {
    const res = await fetch("https://quickchart.io/chart/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chart: config, width, height, backgroundColor: "white", format: "png" }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.url ?? null;
  } catch {
    return null;
  }
}
