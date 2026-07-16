import { createServiceClient } from "@/lib/supabase/server";
import { blocksToText } from "@/lib/agent-runner";
import { chunkText } from "./chunker";
import { embedDocuments, embedQuery } from "./embeddings";
import { extractText } from "./extract";

/**
 * Knowledge ingestion pipeline: source row → text → chunks → embeddings →
 * knowledge_chunks, with an ingest_jobs row per run. Replaces the legacy
 * fire-and-forget reindexSource pipeline (lib/embeddings.ts / doc_chunks).
 */

export const STORAGE_BUCKET = "documents";

export interface KnowledgeSource {
  id: string;
  org_id: string;
  type: string;
  title: string;
  origin_id: string | null;
  storage_path: string | null;
  url: string | null;
  mime_type: string | null;
  raw_text: string | null;
  space_id: string | null;
  status: string;
}

const CHUNK_INSERT_BATCH = 200;

async function resolveText(svc: ReturnType<typeof createServiceClient>, source: KnowledgeSource): Promise<{ title: string; text: string }> {
  switch (source.type) {
    case "file": {
      if (!source.storage_path) throw new Error("File source has no storage_path");
      const { data, error } = await svc.storage.from(STORAGE_BUCKET).download(source.storage_path);
      if (error || !data) throw new Error(`Storage download failed: ${error?.message ?? "no data"}`);
      const text = await extractText(await data.arrayBuffer(), source.title || source.storage_path, source.mime_type);
      return { title: source.title, text };
    }
    case "doc": {
      const { data } = await svc.from("docs").select("title, blocks")
        .eq("id", source.origin_id).eq("org_id", source.org_id).maybeSingle();
      if (!data) throw new Error("Origin doc not found");
      return { title: data.title ?? source.title, text: blocksToText((data.blocks as unknown[]) ?? []) };
    }
    case "kb": {
      const { data } = await svc.from("kb_articles").select("title, summary, content")
        .eq("id", source.origin_id).eq("org_id", source.org_id).maybeSingle();
      if (!data) throw new Error("Origin KB article not found");
      return { title: data.title ?? source.title, text: `${data.summary ?? ""}\n${data.content ?? ""}` };
    }
    case "text":
    case "capture":
    case "url":
      return { title: source.title, text: source.raw_text ?? "" };
    default:
      throw new Error(`No ingester for source type "${source.type}"`);
  }
}

/**
 * Run (or re-run) ingestion for one source. Synchronous — callers on a
 * request path should await it; a background runner can call it too.
 */
export async function runIngest(sourceId: string): Promise<{ ok: true; chunks: number } | { ok: false; error: string }> {
  const svc = createServiceClient();
  const { data: source } = await svc.from("knowledge_sources")
    .select("*").eq("id", sourceId).maybeSingle<KnowledgeSource>();
  if (!source) return { ok: false, error: "Source not found" };

  const startedAt = Date.now();
  const { data: job } = await svc.from("ingest_jobs")
    .insert({ org_id: source.org_id, source_id: source.id, status: "running", started_at: new Date().toISOString() })
    .select("id").single();
  await svc.from("knowledge_sources").update({ status: "processing", error: null, updated_at: new Date().toISOString() }).eq("id", source.id);

  const fail = async (message: string) => {
    await svc.from("knowledge_sources").update({ status: "error", error: message, updated_at: new Date().toISOString() }).eq("id", source.id);
    if (job) await svc.from("ingest_jobs").update({ status: "error", error: message, finished_at: new Date().toISOString() }).eq("id", job.id);
    return { ok: false as const, error: message };
  };

  try {
    const { title, text } = await resolveText(svc, source);
    const chunks = chunkText(text, title);
    const vectors = await embedDocuments(chunks.map((c) => c.content));

    await svc.from("knowledge_chunks").delete().eq("source_id", source.id);
    for (let i = 0; i < chunks.length; i += CHUNK_INSERT_BATCH) {
      const batch = chunks.slice(i, i + CHUNK_INSERT_BATCH).map((c, j) => ({
        org_id: source.org_id,
        source_id: source.id,
        chunk_index: c.index,
        title,
        content: c.content,
        embedding: vectors[i + j],
      }));
      const { error } = await svc.from("knowledge_chunks").insert(batch);
      if (error) throw new Error(`Chunk insert failed: ${error.message}`);
    }

    const now = new Date().toISOString();
    await svc.from("knowledge_sources").update({
      status: "ready", error: null, title, chunk_count: chunks.length, last_ingested_at: now, updated_at: now,
    }).eq("id", source.id);
    if (job) {
      await svc.from("ingest_jobs").update({
        status: "done", finished_at: now,
        stats: { chars: text.length, chunks: chunks.length, ms: Date.now() - startedAt },
      }).eq("id", job.id);
    }
    return { ok: true, chunks: chunks.length };
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e));
  }
}

export interface KnowledgeMatch {
  source_id: string;
  source_type: string;
  title: string;
  content: string;
  chunk_index: number;
  space_id: string | null;
  similarity: number;
}

/** Permission-aware semantic search. Throws EmbeddingsError if unconfigured. */
export async function searchKnowledge(
  caller: { orgId: string; userId: string; role: string },
  query: string,
  k = 8,
): Promise<KnowledgeMatch[]> {
  const vector = await embedQuery(query);
  const svc = createServiceClient();
  const { data, error } = await svc.rpc("match_knowledge_chunks", {
    query_embedding: vector,
    p_org: caller.orgId,
    p_user: caller.userId,
    p_role: caller.role,
    match_count: k,
  });
  if (error) throw new Error(`Knowledge search failed: ${error.message}`);
  return (data ?? []) as KnowledgeMatch[];
}
