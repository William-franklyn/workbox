import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

async function getOrgId(userId: string) {
  const svc = createServiceClient();
  const { data } = await svc.from("profiles").select("organization_id").eq("id", userId).maybeSingle();
  return data?.organization_id ?? null;
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId(user.id);
  const svc = createServiceClient();
  const folder = req.nextUrl.searchParams.get("folder");
  const search = req.nextUrl.searchParams.get("search");

  let q = svc.from("org_documents").select("id,name,description,folder,file_type,file_size,status,tags,version,author_name,created_by,expires_at,created_at,updated_at").order("updated_at", { ascending: false });
  if (orgId) q = q.eq("org_id", orgId);
  if (folder && folder !== "all") q = q.eq("folder", folder);
  if (search) q = q.ilike("name", `%${search}%`);
  const { data, error } = await q;
  if (error) return NextResponse.json([], { status: 200 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId(user.id);
  const svc = createServiceClient();
  const body = await req.json();
  const { data: profile } = await svc.from("profiles").select("full_name").eq("id", user.id).maybeSingle();

  const { data, error } = await svc.from("org_documents").insert({
    name: body.name ?? "Untitled Document",
    description: body.description ?? null,
    content: body.content ?? null,
    file_url: body.file_url ?? null,
    file_type: body.file_type ?? "document",
    folder: body.folder ?? "General",
    status: body.status ?? "draft",
    tags: body.tags ?? [],
    expires_at: body.expires_at ?? null,
    org_id: orgId,
    created_by: user.id,
    author_name: (profile as { full_name?: string } | null)?.full_name ?? user.email?.split("@")[0] ?? "Unknown",
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const svc = createServiceClient();
  const { id, ...updates } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const { data, error } = await svc.from("org_documents").update({ ...updates, updated_at: new Date().toISOString() }).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const svc = createServiceClient();
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await svc.from("org_documents").delete().eq("id", id);
  return NextResponse.json({ ok: true });
}
