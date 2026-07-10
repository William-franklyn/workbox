import { createServiceClient } from "@/lib/supabase/server";

/**
 * Semantic search over docs + knowledge base (pgvector).
 *
 * Embeddings come from HuggingFace's free Inference API
 * (sentence-transformers/all-MiniLM-L6-v2, 384 dims). Every write path calls
 * reindexSource fire-and-forget; the agent queries via searchChunks.
 */

const HF_MODEL = "sentence-transformers/all-MiniLM-L6-v2";
const HF_URL = `https://router.huggingface.co/hf-inference/models/${HF_MODEL}/pipeline/feature-extraction`;

const CHUNK_SIZE = 1200;   // chars
const CHUNK_OVERLAP = 150;

export async function embedTexts(texts: string[]): Promise<number[][] | null> {
  const key = process.env.HUGGINGFACE_API_KEY;
  if (!key || !texts.length) return null;
  try {
    const res = await fetch(HF_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ inputs: texts }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data) && Array.isArray(data[0]) ? data as number[][] : null;
  } catch {
    return null;
  }
}

export function chunkText(text: string): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  if (clean.length <= CHUNK_SIZE) return [clean];
  const chunks: string[] = [];
  let start = 0;
  while (start < clean.length) {
    let end = Math.min(start + CHUNK_SIZE, clean.length);
    // Prefer to break at a sentence boundary near the end of the window
    if (end < clean.length) {
      const dot = clean.lastIndexOf(". ", end);
      if (dot > start + CHUNK_SIZE * 0.5) end = dot + 1;
    }
    chunks.push(clean.slice(start, end).trim());
    if (end >= clean.length) break;
    start = end - CHUNK_OVERLAP;
  }
  return chunks.filter(Boolean);
}

/**
 * Rebuild the embedded chunks for one document/article. Callers should not
 * await this on the hot path — fire and forget.
 */
export async function reindexSource(
  sourceType: "doc" | "kb",
  sourceId: string,
  orgId: string | null,
  title: string,
  text: string,
): Promise<void> {
  try {
    const supabase = createServiceClient();
    await supabase.from("doc_chunks").delete()
      .eq("source_type", sourceType).eq("source_id", sourceId);

    const chunks = chunkText(`${title}\n${text}`);
    if (!chunks.length) return;

    const vectors = await embedTexts(chunks);
    if (!vectors) return;

    await supabase.from("doc_chunks").insert(chunks.map((content, i) => ({
      org_id: orgId,
      source_type: sourceType,
      source_id: sourceId,
      title,
      chunk_index: i,
      content,
      embedding: vectors[i],
    })));
  } catch {
    /* embedding failures must never break a save */
  }
}

export async function removeSource(sourceType: "doc" | "kb", sourceId: string): Promise<void> {
  try {
    const supabase = createServiceClient();
    await supabase.from("doc_chunks").delete()
      .eq("source_type", sourceType).eq("source_id", sourceId);
  } catch { /* ignore */ }
}

export interface ChunkMatch {
  source_type: string;
  source_id: string;
  title: string;
  content: string;
  similarity: number;
}

export async function searchChunks(query: string, orgId: string, k = 5): Promise<ChunkMatch[] | null> {
  const vectors = await embedTexts([query]);
  if (!vectors) return null;
  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc("match_doc_chunks", {
    query_embedding: vectors[0],
    p_org: orgId,
    match_count: k,
  });
  if (error) return null;
  return (data ?? []) as ChunkMatch[];
}
