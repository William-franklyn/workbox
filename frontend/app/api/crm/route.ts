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
  const type = req.nextUrl.searchParams.get("type") ?? "contacts";
  const search = req.nextUrl.searchParams.get("search") ?? "";

  if (type === "contacts") {
    let q = svc.from("crm_contacts").select("*, company:crm_companies(id,name)").order("created_at", { ascending: false });
    if (orgId) q = q.eq("org_id", orgId);
    if (search) q = q.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`);
    const { data } = await q;
    return NextResponse.json(data ?? []);
  }
  if (type === "companies") {
    let q = svc.from("crm_companies").select("*").order("created_at", { ascending: false });
    if (orgId) q = q.eq("org_id", orgId);
    if (search) q = q.ilike("name", `%${search}%`);
    const { data } = await q;
    return NextResponse.json(data ?? []);
  }
  if (type === "deals") {
    let q = svc.from("crm_deals").select("*, contact:crm_contacts(id,first_name,last_name), company:crm_companies(id,name)").order("created_at", { ascending: false });
    if (orgId) q = q.eq("org_id", orgId);
    const { data } = await q;
    return NextResponse.json(data ?? []);
  }
  return NextResponse.json([]);
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId(user.id);
  const svc = createServiceClient();
  const body = await req.json();
  const { type, ...fields } = body;

  const table = type === "company" ? "crm_companies" : type === "deal" ? "crm_deals" : "crm_contacts";
  const payload = { ...fields, org_id: orgId, created_by: user.id };
  let { data, error } = await svc.from(table).insert(payload).select().single();
  // Resilient to the linkedin_url column not being migrated yet (031).
  if (error && /linkedin_url/.test(error.message)) {
    const { linkedin_url: _drop, ...rest } = payload;
    void _drop;
    ({ data, error } = await svc.from(table).insert(rest).select().single());
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const svc = createServiceClient();
  const { id, type, ...updates } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const table = type === "company" ? "crm_companies" : type === "deal" ? "crm_deals" : "crm_contacts";
  const patch = { ...updates, updated_at: new Date().toISOString() };
  let { data, error } = await svc.from(table).update(patch).eq("id", id).select().single();
  if (error && /linkedin_url/.test(error.message)) {
    const { linkedin_url: _drop, ...rest } = patch;
    void _drop;
    ({ data, error } = await svc.from(table).update(rest).eq("id", id).select().single());
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const svc = createServiceClient();
  const id = req.nextUrl.searchParams.get("id");
  const type = req.nextUrl.searchParams.get("type") ?? "contact";
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const table = type === "company" ? "crm_companies" : type === "deal" ? "crm_deals" : "crm_contacts";
  await svc.from(table).delete().eq("id", id);
  return NextResponse.json({ ok: true });
}
