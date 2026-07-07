import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { cache, getRedis } from "@/lib/redis";

async function getOrgId(userId: string) {
  const svc = createServiceClient();
  const { data } = await svc.from("profiles").select("organization_id").eq("id", userId).maybeSingle();
  return data?.organization_id ?? null;
}

async function kbVersion(orgId: string | null): Promise<number> {
  if (!orgId) return 0;
  const redis = getRedis();
  if (!redis) return 0;
  try { return (await redis.get<number>(`kb:v:${orgId}`)) ?? 0; } catch { return 0; }
}

async function bumpKbVersion(orgId: string | null): Promise<void> {
  if (!orgId) return;
  const redis = getRedis();
  if (!redis) return;
  try { await redis.incr(`kb:v:${orgId}`); } catch { /* ignore */ }
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId(user.id);
  const svc = createServiceClient();
  const type = req.nextUrl.searchParams.get("type");
  const v = await kbVersion(orgId);

  if (type === "categories") {
    const data = await cache(`kb:c:${orgId}:v${v}`, 300, async () => {
      let q = svc.from("kb_categories").select("*").order("position").order("name");
      if (orgId) q = q.eq("org_id", orgId); else q = q.is("org_id", null);
      const { data: rows } = await q;
      return rows ?? [];
    });
    return NextResponse.json(data);
  }

  const catId = req.nextUrl.searchParams.get("category");
  const search = req.nextUrl.searchParams.get("search");
  const data = await cache(`kb:a:${orgId}:v${v}:${catId}:${search}`, 30, async () => {
    let q = svc.from("kb_articles").select("id,title,summary,category_id,tags,published,views,author_name,created_at,updated_at").order("updated_at", { ascending: false });
    if (orgId) q = q.eq("org_id", orgId); else q = q.is("org_id", null);
    if (catId) q = q.eq("category_id", catId);
    if (search) q = q.ilike("title", `%${search}%`);
    const { data: rows } = await q;
    return rows ?? [];
  });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId(user.id);
  const svc = createServiceClient();
  const body = await req.json();

  if (body.type === "category") {
    const { data, error } = await svc.from("kb_categories").insert({
      name: body.name ?? "New Category", icon: body.icon ?? "📁",
      org_id: orgId, parent_id: body.parent_id ?? null, position: body.position ?? 0,
    }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    await bumpKbVersion(orgId);
    return NextResponse.json(data);
  }

  const { data: profile } = await svc.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
  const { data, error } = await svc.from("kb_articles").insert({
    title: body.title ?? "Untitled Article",
    content: body.content ?? "",
    summary: body.summary ?? null,
    category_id: body.category_id ?? null,
    org_id: orgId,
    created_by: user.id,
    author_name: (profile as { full_name?: string } | null)?.full_name ?? user.email?.split("@")[0] ?? "Unknown",
    tags: body.tags ?? [],
    published: body.published ?? true,
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await bumpKbVersion(orgId);
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId(user.id);
  const svc = createServiceClient();
  const { id, type, ...updates } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const table = type === "category" ? "kb_categories" : "kb_articles";
  const patch = type === "category" ? updates : { ...updates, updated_at: new Date().toISOString() };
  const { data, error } = await svc.from(table).update(patch).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await bumpKbVersion(orgId);
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId(user.id);
  const svc = createServiceClient();
  const id = req.nextUrl.searchParams.get("id");
  const type = req.nextUrl.searchParams.get("type");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const table = type === "category" ? "kb_categories" : "kb_articles";
  await svc.from(table).delete().eq("id", id);
  await bumpKbVersion(orgId);
  return NextResponse.json({ ok: true });
}
