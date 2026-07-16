import type { KnowledgeMatch } from "./ingest";

/**
 * Prompt assembly + answer metadata for /api/knowledge/ask.
 * The design contract (docs/VISION.md, Security UX): every AI answer carries
 * sources, a confidence signal, and an explanation of how it was produced.
 */

export const ASK_MODEL = "claude-sonnet-5";

export const ASK_SYSTEM_PROMPT = `You are WorkBox's enterprise knowledge assistant. You answer questions using ONLY the numbered sources provided — never from your own general knowledge.

Rules:
- Cite sources inline with bracketed numbers matching the source list, e.g. [1] or [2][3]. Every factual claim needs a citation.
- If the sources don't contain enough information to answer, say so plainly and name what's missing. Do not guess or fill gaps.
- If sources conflict, surface the conflict and cite both sides.
- Be direct and concise. Answer first, supporting detail after.`;

/** One retrieved chunk, numbered for citation. */
export interface AskSource {
  index: number;
  source_id: string;
  source_type: string;
  title: string;
  space_id: string | null;
  similarity: number;
}

/**
 * Collapse chunk matches into numbered sources (one number per source
 * document, not per chunk) and a context block for the model.
 */
export function buildAskContext(matches: KnowledgeMatch[]): { sources: AskSource[]; context: string } {
  const sources: AskSource[] = [];
  const bySourceId = new Map<string, AskSource>();
  const sections: string[] = [];

  for (const m of matches) {
    let src = bySourceId.get(m.source_id);
    if (!src) {
      src = {
        index: sources.length + 1,
        source_id: m.source_id,
        source_type: m.source_type,
        title: m.title || "Untitled",
        space_id: m.space_id,
        similarity: m.similarity,
      };
      bySourceId.set(m.source_id, src);
      sources.push(src);
    }
    src.similarity = Math.max(src.similarity, m.similarity);
    sections.push(`[${src.index}] ${src.title}\n${m.content}`);
  }

  return { sources, context: sections.join("\n\n---\n\n") };
}

/**
 * Retrieval-strength heuristic from cosine similarity of the best match.
 * Thresholds are empirical for 1024-dim Voyage/OpenAI embeddings — tune
 * against real org data once we have it. This measures how well the query
 * matched the knowledge base, not whether the answer is correct.
 */
export function retrievalConfidence(matches: KnowledgeMatch[]): "high" | "medium" | "low" {
  const top = matches[0]?.similarity ?? 0;
  if (top >= 0.72) return "high";
  if (top >= 0.55) return "medium";
  return "low";
}
