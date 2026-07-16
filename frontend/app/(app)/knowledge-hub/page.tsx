"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Brain, Sparkles, FileText, BookOpen, Globe, Type, Upload, RefreshCw,
  Trash2, Loader2, X, AlertTriangle, CheckCircle2, Clock, Send, Database,
} from "lucide-react";
import { toast } from "@/store/toast";

// ─── Types (mirror the /api/knowledge contracts) ─────────────────────────────

interface KnowledgeSource {
  id: string; type: string; title: string; origin_id: string | null;
  url: string | null; mime_type: string | null; size_bytes: number | null;
  space_id: string | null; status: "pending" | "processing" | "ready" | "error";
  error: string | null; chunk_count: number; last_ingested_at: string | null; created_at: string;
}

interface AskSource {
  index: number; source_id: string; source_type: string;
  title: string; space_id: string | null; similarity: number;
}

type Confidence = "high" | "medium" | "low";

const TYPE_ICONS: Record<string, typeof FileText> = {
  file: FileText, doc: FileText, kb: BookOpen, url: Globe, capture: Globe, text: Type, connector: Database,
};

const CONFIDENCE_META: Record<Confidence, { label: string; color: string }> = {
  high: { label: "High confidence", color: "var(--success, #22c55e)" },
  medium: { label: "Medium confidence", color: "var(--warning, #f59e0b)" },
  low: { label: "Low confidence", color: "var(--danger, #ef4444)" },
};

function formatBytes(n: number | null): string {
  if (!n) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Ask panel ───────────────────────────────────────────────────────────────

function AskPanel({ initialQuestion }: { initialQuestion?: string }) {
  const [question, setQuestion] = useState(initialQuestion ?? "");
  const [asking, setAsking] = useState(false);
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState<AskSource[]>([]);
  const [confidence, setConfidence] = useState<Confidence | null>(null);
  const [asked, setAsked] = useState<string | null>(null);
  const autoAsked = useRef(false);

  async function ask(text?: string) {
    const q = (text ?? question).trim();
    if (!q || asking) return;
    setAsking(true);
    setAsked(q);
    setAnswer("");
    setSources([]);
    setConfidence(null);

    try {
      const res = await fetch("/api/knowledge/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      if (!res.ok || !res.body) {
        const d = await res.json().catch(() => null);
        toast(d?.error ?? `Ask failed (${res.status})`, { type: "error" });
        setAsking(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const frames = buf.split("\n\n");
        buf = frames.pop() ?? "";
        for (const frame of frames) {
          if (!frame.startsWith("data: ")) continue;
          const evt = JSON.parse(frame.slice(6));
          if (evt.type === "sources") {
            setSources(evt.sources ?? []);
            setConfidence(evt.confidence ?? null);
          } else if (evt.type === "delta") {
            setAnswer((a) => a + evt.text);
          } else if (evt.type === "error") {
            toast(evt.error ?? "Answer failed", { type: "error" });
          }
        }
      }
    } catch {
      toast("Connection lost while streaming the answer", { type: "error" });
    } finally {
      setAsking(false);
    }
  }

  // Arriving from ⌘K ("Ask: …") — run the handed-off question once.
  useEffect(() => {
    if (initialQuestion && !autoAsked.current) {
      autoAsked.current = true;
      void ask(initialQuestion);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuestion]);

  // Render the answer with [n] citations as accent-colored superscripts.
  function renderAnswer(text: string) {
    const parts = text.split(/(\[\d+\](?:\[\d+\])*)/g);
    return parts.map((part, i) => {
      if (/^(\[\d+\])+$/.test(part)) {
        return (
          <sup key={i} className="font-semibold" style={{ color: "var(--accent-purple)" }}>
            {part}
          </sup>
        );
      }
      return <span key={i}>{part}</span>;
    });
  }

  return (
    <div className="max-w-3xl mx-auto w-full">
      {/* Question input — the AI-first entry point */}
      <div
        className="rounded-2xl p-[1px]"
        style={{ background: "linear-gradient(135deg, var(--accent-purple), var(--accent-blue))" }}
      >
        <div className="rounded-2xl flex items-center gap-3 px-4 py-3" style={{ background: "var(--bg-secondary)" }}>
          <Sparkles size={18} style={{ color: "var(--accent-purple)" }} className="shrink-0" />
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") ask(); }}
            placeholder="Ask your organization's knowledge…  e.g. What is our vacation policy?"
            className="flex-1 bg-transparent outline-none text-sm"
            style={{ color: "var(--text-primary)" }}
            disabled={asking}
          />
          <button
            onClick={() => ask()}
            disabled={asking || !question.trim()}
            className="shrink-0 rounded-lg px-3 py-1.5 text-sm font-semibold flex items-center gap-1.5 disabled:opacity-50 text-white"
            style={{ background: "linear-gradient(135deg, var(--accent-purple), var(--accent-blue))" }}
          >
            {asking ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            Ask
          </button>
        </div>
      </div>

      {asked && (
        <div className="mt-6 space-y-4">
          {/* Answer */}
          <div className="rounded-xl border p-5" style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                Answer
              </span>
              {confidence && (
                <span
                  className="text-xs font-medium flex items-center gap-1.5 px-2 py-0.5 rounded-full border"
                  style={{ color: CONFIDENCE_META[confidence].color, borderColor: "var(--border)" }}
                  title="How strongly your knowledge base matched this question — not a guarantee the answer is correct."
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: CONFIDENCE_META[confidence].color }} />
                  {CONFIDENCE_META[confidence].label}
                </span>
              )}
            </div>
            <div className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "var(--text-primary)" }}>
              {answer ? renderAnswer(answer) : (
                <span className="flex items-center gap-2" style={{ color: "var(--text-secondary)" }}>
                  <Loader2 size={14} className="animate-spin" /> Searching your knowledge base…
                </span>
              )}
            </div>
          </div>

          {/* Sources — every answer shows where it came from */}
          {sources.length > 0 && (
            <div>
              <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                Sources
              </span>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {sources.map((s) => {
                  const Icon = TYPE_ICONS[s.source_type] ?? FileText;
                  return (
                    <div
                      key={s.source_id}
                      className="rounded-lg border px-3 py-2 flex items-center gap-2.5"
                      style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}
                    >
                      <span
                        className="w-5 h-5 rounded flex items-center justify-center text-[11px] font-bold shrink-0 text-white"
                        style={{ background: "var(--accent-purple)" }}
                      >
                        {s.index}
                      </span>
                      <Icon size={14} className="shrink-0" style={{ color: "var(--text-secondary)" }} />
                      <span className="text-sm truncate flex-1" style={{ color: "var(--text-primary)" }}>{s.title}</span>
                      <span className="text-xs shrink-0" style={{ color: "var(--text-muted)" }}>
                        {(s.similarity * 100).toFixed(0)}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Sources panel ───────────────────────────────────────────────────────────

function StatusChip({ source }: { source: KnowledgeSource }) {
  if (source.status === "ready") {
    return (
      <span className="text-xs flex items-center gap-1" style={{ color: "var(--success, #22c55e)" }}>
        <CheckCircle2 size={12} /> {source.chunk_count} chunks
      </span>
    );
  }
  if (source.status === "error") {
    return (
      <span className="text-xs flex items-center gap-1" style={{ color: "var(--danger, #ef4444)" }} title={source.error ?? undefined}>
        <AlertTriangle size={12} /> failed
      </span>
    );
  }
  return (
    <span className="text-xs flex items-center gap-1" style={{ color: "var(--warning, #f59e0b)" }}>
      <Clock size={12} /> {source.status}
    </span>
  );
}

function SourcesPanel() {
  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [embeddingsOk, setEmbeddingsOk] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [textModal, setTextModal] = useState(false);
  const [textTitle, setTextTitle] = useState("");
  const [textBody, setTextBody] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    const res = await fetch("/api/knowledge/sources");
    const d = await res.json().catch(() => null);
    setSources(d?.sources ?? []);
    if (typeof d?.embeddings_configured === "boolean") setEmbeddingsOk(d.embeddings_configured);
    setLoading(false);
  }
  useEffect(() => { void load(); }, []);

  async function upload(file: File) {
    setUploading(true);
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch("/api/knowledge/sources", { method: "POST", body: form });
      const d = await res.json().catch(() => null);
      if (!res.ok) {
        toast(d?.error ?? d?.ingest?.error ?? "Upload failed", { type: "error" });
      } else {
        toast(`Ingested "${file.name}" (${d.source?.chunk_count ?? 0} chunks)`, { type: "success" });
      }
    } catch {
      toast("Upload failed", { type: "error" });
    } finally {
      setUploading(false);
      void load();
    }
  }

  async function addText() {
    if (!textTitle.trim() || !textBody.trim()) return;
    setTextModal(false);
    setUploading(true);
    try {
      const res = await fetch("/api/knowledge/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: textTitle.trim(), content: textBody }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) toast(d?.error ?? "Failed to add text", { type: "error" });
      else toast(`Ingested "${textTitle.trim()}"`, { type: "success" });
    } finally {
      setTextTitle(""); setTextBody("");
      setUploading(false);
      void load();
    }
  }

  async function sync() {
    setSyncing(true);
    try {
      const res = await fetch("/api/knowledge/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const d = await res.json().catch(() => null);
      if (!res.ok) toast(d?.error ?? "Sync failed (admin only)", { type: "error" });
      else toast(`Synced ${d.ingested}/${d.scanned} items${d.failed ? `, ${d.failed} failed` : ""}`, { type: d.failed ? "info" : "success" });
    } finally {
      setSyncing(false);
      void load();
    }
  }

  async function reingest(id: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/knowledge/sources/${id}`, { method: "POST" });
      const d = await res.json().catch(() => null);
      if (!res.ok) toast(d?.ingest?.error ?? "Re-ingest failed", { type: "error" });
      else toast("Re-ingested", { type: "success" });
    } finally {
      setBusyId(null);
      void load();
    }
  }

  async function remove(id: string, title: string) {
    if (!confirm(`Remove "${title}" from the knowledge base?`)) return;
    setSources((s) => s.filter((x) => x.id !== id));
    const res = await fetch(`/api/knowledge/sources/${id}`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) { toast("Delete failed", { type: "error" }); void load(); }
  }

  return (
    <div className="max-w-3xl mx-auto w-full">
      {!embeddingsOk && (
        <div className="mb-4 rounded-lg border px-4 py-3 text-sm flex items-center gap-2"
          style={{ borderColor: "var(--warning, #f59e0b)", color: "var(--warning, #f59e0b)", background: "var(--bg-secondary)" }}>
          <AlertTriangle size={16} className="shrink-0" />
          Embeddings are not configured — set VOYAGE_API_KEY (or OPENAI_API_KEY) on the server to enable ingestion and search.
        </div>
      )}

      <div className="flex items-center gap-2 mb-4">
        <input
          ref={fileRef} type="file" className="hidden"
          accept=".pdf,.docx,.txt,.md,.markdown,.csv,.json,.html,.htm,.log,.yaml,.yml"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ""; }}
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="rounded-lg px-3 py-1.5 text-sm font-semibold flex items-center gap-1.5 disabled:opacity-50 text-white"
          style={{ background: "linear-gradient(135deg, var(--accent-purple), var(--accent-blue))" }}
        >
          {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
          Upload file
        </button>
        <button
          onClick={() => setTextModal(true)}
          className="rounded-lg px-3 py-1.5 text-sm font-medium flex items-center gap-1.5 border"
          style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
        >
          <Type size={14} /> Add text
        </button>
        <div className="flex-1" />
        <button
          onClick={sync}
          disabled={syncing}
          title="Ingest existing workspace docs + KB articles (admin)"
          className="rounded-lg px-3 py-1.5 text-sm font-medium flex items-center gap-1.5 border disabled:opacity-50"
          style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
        >
          {syncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          Sync workspace content
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm py-8 justify-center" style={{ color: "var(--text-secondary)" }}>
          <Loader2 size={16} className="animate-spin" /> Loading sources…
        </div>
      ) : sources.length === 0 ? (
        <div className="text-center py-14 rounded-xl border" style={{ borderColor: "var(--border)" }}>
          <Brain size={28} className="mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
          <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>No knowledge sources yet</p>
          <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
            Upload a PDF or document, or sync your existing workspace content.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border divide-y" style={{ borderColor: "var(--border)" }}>
          {sources.map((s) => {
            const Icon = TYPE_ICONS[s.type] ?? FileText;
            return (
              <div key={s.id} className="group flex items-center gap-3 px-4 py-2.5" style={{ borderColor: "var(--border)" }}>
                <Icon size={16} className="shrink-0" style={{ color: "var(--text-secondary)" }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate" style={{ color: "var(--text-primary)" }}>{s.title}</p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {s.type}{s.size_bytes ? ` · ${formatBytes(s.size_bytes)}` : ""} · {new Date(s.created_at).toLocaleDateString()}
                  </p>
                </div>
                <StatusChip source={s} />
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => reingest(s.id)} disabled={busyId === s.id} title="Re-ingest"
                    className="p-1.5 rounded hover:bg-white/5" style={{ color: "var(--text-secondary)" }}>
                    {busyId === s.id ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                  </button>
                  <button onClick={() => remove(s.id, s.title)} title="Delete"
                    className="p-1.5 rounded hover:bg-white/5" style={{ color: "var(--danger, #ef4444)" }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add-text modal */}
      {textModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setTextModal(false)}>
          <div
            className="w-full max-w-lg rounded-xl border p-5"
            style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Add text to the knowledge base</h3>
              <button onClick={() => setTextModal(false)} style={{ color: "var(--text-secondary)" }}><X size={16} /></button>
            </div>
            <input
              value={textTitle} onChange={(e) => setTextTitle(e.target.value)} placeholder="Title"
              className="w-full rounded-lg border px-3 py-2 text-sm mb-3 bg-transparent outline-none"
              style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
            />
            <textarea
              value={textBody} onChange={(e) => setTextBody(e.target.value)} placeholder="Paste the content…" rows={8}
              className="w-full rounded-lg border px-3 py-2 text-sm mb-4 bg-transparent outline-none resize-none"
              style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setTextModal(false)} className="rounded-lg px-3 py-1.5 text-sm border"
                style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>Cancel</button>
              <button onClick={addText} disabled={!textTitle.trim() || !textBody.trim()}
                className="rounded-lg px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: "linear-gradient(135deg, var(--accent-purple), var(--accent-blue))" }}>
                Add & ingest
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

function KnowledgeHub() {
  // useSearchParams needs a Suspense boundary (see page default export).
  const searchParams = useSearchParams();
  const initialQuestion = searchParams.get("q")?.trim() || undefined;
  const [tab, setTab] = useState<"ask" | "sources">("ask");

  return (
    <div className="h-full min-h-0 overflow-y-auto">
      <div className="px-6 pt-6 pb-4 max-w-3xl mx-auto w-full">
        <div className="flex items-center gap-2.5 mb-1">
          <Brain size={20} style={{ color: "var(--accent-purple)" }} />
          <h1 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>Knowledge</h1>
        </div>
        <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
          Your organization&apos;s trusted knowledge — searchable, permission-aware, and cited.
        </p>

        <div className="flex gap-1 border-b" style={{ borderColor: "var(--border)" }}>
          {([["ask", "Ask"], ["sources", "Sources"]] as const).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className="px-3 py-2 text-sm font-medium -mb-px border-b-2 transition-colors"
              style={{
                borderColor: tab === id ? "var(--accent-purple)" : "transparent",
                color: tab === id ? "var(--text-primary)" : "var(--text-secondary)",
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-6 pb-10">
        {tab === "ask" ? <AskPanel initialQuestion={initialQuestion} /> : <SourcesPanel />}
      </div>
    </div>
  );
}

export default function KnowledgeHubPage() {
  return (
    <Suspense fallback={null}>
      <KnowledgeHub />
    </Suspense>
  );
}
