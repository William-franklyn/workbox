import { createServiceClient } from "@/lib/supabase/server";
import { runIngest } from "./ingest";

/**
 * Live re-indexing hooks for internal WorkBox content (docs, KB articles).
 * Called fire-and-forget (`void reindexInternal(...)`) from every write path
 * so the knowledge base never goes stale — replaces the legacy
 * lib/embeddings.ts reindexSource/removeSource pair. Never throws: an
 * embedding failure must never break a save (the source row keeps the error).
 */

export async function reindexInternal(
  type: "doc" | "kb",
  originId: string,
  orgId: string | null,
  title: string,
): Promise<void> {
  if (!orgId) return;
  try {
    const svc = createServiceClient();
    const { data: source } = await svc.from("knowledge_sources").upsert({
      org_id: orgId,
      type,
      origin_id: originId,
      title,
      updated_at: new Date().toISOString(),
    }, { onConflict: "org_id,type,origin_id" }).select("id").single();
    if (source) await runIngest(source.id);
  } catch {
    /* never break the save path */
  }
}

export async function removeInternal(type: "doc" | "kb", originId: string): Promise<void> {
  try {
    const svc = createServiceClient();
    // Origin ids are UUIDs — globally unique, so no org filter needed.
    await svc.from("knowledge_sources").delete().eq("type", type).eq("origin_id", originId);
  } catch {
    /* ignore */
  }
}

/**
 * App-relative link for a search match, best-effort per source type.
 * Callers prefix with BASE_URL when they need an absolute URL.
 */
export function sourceHref(sourceType: string, originId: string | null, url: string | null): string {
  if (sourceType === "doc" && originId) return `/docs/${originId}`;
  if (sourceType === "kb") return "/knowledge";
  if (url) return url; // connectors carry their origin link (e.g. Drive webViewLink)
  return "/knowledge-hub";
}
