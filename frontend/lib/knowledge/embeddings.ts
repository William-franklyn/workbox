/**
 * Embedding provider for the knowledge platform (1024-dim, pgvector).
 *
 * Provider is picked from env: VOYAGE_API_KEY (voyage-3.5) wins, otherwise
 * OPENAI_API_KEY (text-embedding-3-small at dimensions=1024). Both produce
 * 1024-dim vectors so the knowledge_chunks schema is provider-agnostic.
 *
 * Unlike the legacy lib/embeddings.ts (which swallows failures because it
 * runs fire-and-forget on save paths), these functions throw — ingest jobs
 * record the error and mark the source as failed.
 */

export const EMBEDDING_DIMS = 1024;

const VOYAGE_MODEL = "voyage-3.5";
const OPENAI_MODEL = "text-embedding-3-small";
const BATCH_SIZE = 96;

export type EmbedPurpose = "document" | "query";

export class EmbeddingsError extends Error {}

type Provider = { name: "voyage" | "openai"; key: string };

function getProvider(): Provider {
  const voyage = process.env.VOYAGE_API_KEY;
  if (voyage) return { name: "voyage", key: voyage };
  const openai = process.env.OPENAI_API_KEY;
  if (openai) return { name: "openai", key: openai };
  throw new EmbeddingsError(
    "No embedding provider configured — set VOYAGE_API_KEY or OPENAI_API_KEY",
  );
}

async function embedBatch(texts: string[], purpose: EmbedPurpose, provider: Provider): Promise<number[][]> {
  const url = provider.name === "voyage"
    ? "https://api.voyageai.com/v1/embeddings"
    : "https://api.openai.com/v1/embeddings";

  const body = provider.name === "voyage"
    ? { input: texts, model: VOYAGE_MODEL, input_type: purpose, output_dimension: EMBEDDING_DIMS }
    : { input: texts, model: OPENAI_MODEL, dimensions: EMBEDDING_DIMS };

  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${provider.key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new EmbeddingsError(`${provider.name} embeddings failed (${res.status}): ${detail.slice(0, 300)}`);
  }

  const data = await res.json() as { data?: Array<{ index?: number; embedding?: number[] }> };
  const rows = data.data;
  if (!Array.isArray(rows) || rows.length !== texts.length) {
    throw new EmbeddingsError(`${provider.name} returned ${rows?.length ?? 0} embeddings for ${texts.length} inputs`);
  }

  // Both APIs document input order, but OpenAI also sends an index — honor it.
  const out: number[][] = new Array(texts.length);
  rows.forEach((row, i) => {
    const vec = row.embedding;
    if (!Array.isArray(vec) || vec.length !== EMBEDDING_DIMS) {
      throw new EmbeddingsError(`${provider.name} returned a ${vec?.length ?? 0}-dim vector, expected ${EMBEDDING_DIMS}`);
    }
    out[row.index ?? i] = vec;
  });
  return out;
}

/** Embed document chunks for indexing. Throws EmbeddingsError on failure. */
export async function embedDocuments(texts: string[]): Promise<number[][]> {
  if (!texts.length) return [];
  const provider = getProvider();
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    out.push(...await embedBatch(texts.slice(i, i + BATCH_SIZE), "document", provider));
  }
  return out;
}

/** Embed a search query. Throws EmbeddingsError on failure. */
export async function embedQuery(text: string): Promise<number[]> {
  const [vec] = await embedBatch([text], "query", getProvider());
  return vec;
}

export function embeddingsConfigured(): boolean {
  return Boolean(process.env.VOYAGE_API_KEY || process.env.OPENAI_API_KEY);
}
