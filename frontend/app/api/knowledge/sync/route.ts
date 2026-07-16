import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { embeddingsConfigured } from "@/lib/knowledge/embeddings";
import { runIngest } from "@/lib/knowledge/ingest";

export const maxDuration = 300;

const SYNC_LIMIT = 100; // per run, per type — re-run to continue

/**
 * Ingest existing WorkBox content (docs + KB articles) into the knowledge
 * platform. Idempotent: sources are upserted on (org, type, origin_id), so
 * re-running refreshes rather than duplicates.
 */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;
  const { ctx } = auth;

  if (!embeddingsConfigured()) {
    return NextResponse.json(
      { error: "Embeddings not configured — set VOYAGE_API_KEY or OPENAI_API_KEY" },
      { status: 503 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const types: string[] = Array.isArray(body?.types) && body.types.length ? body.types : ["doc", "kb"];

  const targets: Array<{ type: "doc" | "kb"; origin_id: string; title: string }> = [];

  if (types.includes("doc")) {
    const { data } = await ctx.svc.from("docs").select("id, title")
      .eq("org_id", ctx.orgId).order("updated_at", { ascending: false }).limit(SYNC_LIMIT);
    for (const d of data ?? []) targets.push({ type: "doc", origin_id: d.id, title: d.title ?? "Untitled" });
  }
  if (types.includes("kb")) {
    const { data } = await ctx.svc.from("kb_articles").select("id, title")
      .eq("org_id", ctx.orgId).order("updated_at", { ascending: false }).limit(SYNC_LIMIT);
    for (const a of data ?? []) targets.push({ type: "kb", origin_id: a.id, title: a.title ?? "Untitled" });
  }

  let ingested = 0;
  let failed = 0;
  const errors: Array<{ origin_id: string; error: string }> = [];

  for (const t of targets) {
    const { data: source, error } = await ctx.svc.from("knowledge_sources").upsert({
      org_id: ctx.orgId,
      created_by: ctx.userId,
      type: t.type,
      origin_id: t.origin_id,
      title: t.title,
    }, { onConflict: "org_id,type,origin_id" }).select("id").single();
    if (error || !source) {
      failed++;
      errors.push({ origin_id: t.origin_id, error: error?.message ?? "upsert failed" });
      continue;
    }
    const result = await runIngest(source.id);
    if (result.ok) ingested++;
    else {
      failed++;
      errors.push({ origin_id: t.origin_id, error: result.error });
    }
  }

  return NextResponse.json({
    scanned: targets.length,
    ingested,
    failed,
    errors: errors.slice(0, 10),
    note: targets.length === SYNC_LIMIT * types.length ? "Limit reached — run again to continue" : undefined,
  });
}
