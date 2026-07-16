import { NextRequest, NextResponse } from "next/server";
import { requireOrg } from "@/lib/auth/guard";
import { runIngest, STORAGE_BUCKET } from "@/lib/knowledge/ingest";

export const maxDuration = 120;

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requireOrg(req);
  if ("error" in auth) return auth.error;
  const { ctx } = auth;
  const { id } = await params;

  const { data: source } = await ctx.svc.from("knowledge_sources")
    .select("*").eq("id", id).eq("org_id", ctx.orgId).maybeSingle();
  if (!source) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (ctx.role === "guest") {
    const { data: perm } = source.space_id
      ? await ctx.svc.from("space_permissions").select("id")
          .eq("user_id", ctx.userId).eq("space_id", source.space_id).maybeSingle()
      : { data: null };
    if (!perm) return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: jobs } = await ctx.svc.from("ingest_jobs")
    .select("id, status, error, stats, created_at, finished_at")
    .eq("source_id", id).order("created_at", { ascending: false }).limit(5);

  return NextResponse.json({ source, jobs: jobs ?? [] });
}

/** Re-ingest. */
export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireOrg(req);
  if ("error" in auth) return auth.error;
  const { ctx } = auth;
  if (ctx.role === "guest") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;

  const { data: source } = await ctx.svc.from("knowledge_sources")
    .select("id").eq("id", id).eq("org_id", ctx.orgId).maybeSingle();
  if (!source) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const result = await runIngest(id);
  const { data: fresh } = await ctx.svc.from("knowledge_sources")
    .select("*").eq("id", id).maybeSingle();
  return NextResponse.json({ source: fresh, ingest: result }, { status: result.ok ? 200 : 502 });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await requireOrg(req);
  if ("error" in auth) return auth.error;
  const { ctx } = auth;
  if (ctx.role === "guest") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;

  const { data: source } = await ctx.svc.from("knowledge_sources")
    .select("id, storage_path").eq("id", id).eq("org_id", ctx.orgId).maybeSingle();
  if (!source) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (source.storage_path) {
    await ctx.svc.storage.from(STORAGE_BUCKET).remove([source.storage_path]);
  }
  const { error } = await ctx.svc.from("knowledge_sources").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
