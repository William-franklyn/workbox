import { NextRequest, NextResponse } from "next/server";
import { requireOrg, assertSpaceInOrg } from "@/lib/auth/guard";
import { extractableType } from "@/lib/knowledge/extract";
import { embeddingsConfigured } from "@/lib/knowledge/embeddings";
import { runIngest, STORAGE_BUCKET } from "@/lib/knowledge/ingest";

export const maxDuration = 120; // large files: extract + embed inline

const MAX_FILE_BYTES = 20 * 1024 * 1024;

const SOURCE_COLUMNS =
  "id, type, title, origin_id, url, mime_type, size_bytes, space_id, status, error, chunk_count, last_ingested_at, created_at";

export async function GET(req: NextRequest) {
  const auth = await requireOrg(req);
  if ("error" in auth) return auth.error;
  const { ctx } = auth;

  let q = ctx.svc.from("knowledge_sources").select(SOURCE_COLUMNS)
    .eq("org_id", ctx.orgId).order("created_at", { ascending: false }).limit(200);

  if (ctx.role === "guest") {
    const { data: perms } = await ctx.svc.from("space_permissions")
      .select("space_id").eq("user_id", ctx.userId);
    const spaceIds = (perms ?? []).map((p) => p.space_id);
    if (!spaceIds.length) return NextResponse.json({ sources: [] });
    q = q.in("space_id", spaceIds);
  }

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ sources: data ?? [], embeddings_configured: embeddingsConfigured() });
}

export async function POST(req: NextRequest) {
  const auth = await requireOrg(req);
  if ("error" in auth) return auth.error;
  const { ctx } = auth;
  if (ctx.role === "guest") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (!embeddingsConfigured()) {
    return NextResponse.json(
      { error: "Embeddings not configured — set VOYAGE_API_KEY or OPENAI_API_KEY" },
      { status: 503 },
    );
  }

  const contentType = req.headers.get("content-type") ?? "";

  // ── File upload ──────────────────────────────────────────────────────────
  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const spaceId = (form.get("spaceId") as string | null) || null;
    if (!file) return NextResponse.json({ error: "Missing file" }, { status: 400 });
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: "File too large (max 20MB)" }, { status: 413 });
    }
    if (!extractableType(file.name, file.type)) {
      return NextResponse.json({ error: `Unsupported file type: ${file.name}` }, { status: 415 });
    }
    if (spaceId) {
      const denied = await assertSpaceInOrg(ctx, spaceId);
      if (denied) return denied;
    }

    const sourceId = crypto.randomUUID();
    const safeName = file.name.replace(/[^\w.\- ]+/g, "_");
    const storagePath = `knowledge/${ctx.orgId}/${sourceId}/${safeName}`;

    const { error: storageErr } = await ctx.svc.storage.from(STORAGE_BUCKET)
      .upload(storagePath, await file.arrayBuffer(), { contentType: file.type || "application/octet-stream" });
    if (storageErr) return NextResponse.json({ error: storageErr.message }, { status: 500 });

    const { data: source, error } = await ctx.svc.from("knowledge_sources").insert({
      id: sourceId,
      org_id: ctx.orgId,
      created_by: ctx.userId,
      type: "file",
      title: file.name,
      storage_path: storagePath,
      mime_type: file.type || null,
      size_bytes: file.size,
      space_id: spaceId,
    }).select(SOURCE_COLUMNS).single();
    if (error) {
      await ctx.svc.storage.from(STORAGE_BUCKET).remove([storagePath]);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const result = await runIngest(sourceId);
    const { data: fresh } = await ctx.svc.from("knowledge_sources")
      .select(SOURCE_COLUMNS).eq("id", sourceId).maybeSingle();
    return NextResponse.json({ source: fresh ?? source, ingest: result }, { status: result.ok ? 201 : 502 });
  }

  // ── Inline text source ────────────────────────────────────────────────────
  const body = await req.json().catch(() => null);
  if (!body?.content || typeof body.content !== "string") {
    return NextResponse.json({ error: "content required" }, { status: 400 });
  }
  const spaceId: string | null = body.spaceId ?? null;
  if (spaceId) {
    const denied = await assertSpaceInOrg(ctx, spaceId);
    if (denied) return denied;
  }

  const { data: source, error } = await ctx.svc.from("knowledge_sources").insert({
    org_id: ctx.orgId,
    created_by: ctx.userId,
    type: body.url ? "url" : "text",
    title: (body.title as string)?.trim() || "Untitled",
    url: body.url ?? null,
    raw_text: body.content,
    space_id: spaceId,
  }).select(SOURCE_COLUMNS).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const result = await runIngest(source.id);
  const { data: fresh } = await ctx.svc.from("knowledge_sources")
    .select(SOURCE_COLUMNS).eq("id", source.id).maybeSingle();
  return NextResponse.json({ source: fresh ?? source, ingest: result }, { status: result.ok ? 201 : 502 });
}
