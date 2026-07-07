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
  const type = req.nextUrl.searchParams.get("type");
  const budgetId = req.nextUrl.searchParams.get("budget_id");

  if (type === "items" && budgetId) {
    const { data } = await svc.from("budget_items").select("*").eq("budget_id", budgetId).order("category");
    return NextResponse.json(data ?? []);
  }

  let q = svc.from("budgets").select("*").order("created_at", { ascending: false });
  if (orgId) q = q.eq("org_id", orgId);
  const { data } = await q;
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId(user.id);
  const svc = createServiceClient();
  const { type, ...body } = await req.json();

  if (type === "item") {
    const { data, error } = await svc.from("budget_items").insert(body).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data);
  }

  const { data, error } = await svc.from("budgets").insert({ ...body, org_id: orgId, created_by: user.id }).select().single();
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
  const table = type === "item" ? "budget_items" : "budgets";
  const { data, error } = await svc.from(table).update(updates).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const svc = createServiceClient();
  const id = req.nextUrl.searchParams.get("id");
  const type = req.nextUrl.searchParams.get("type") ?? "budget";
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await svc.from(type === "item" ? "budget_items" : "budgets").delete().eq("id", id);
  return NextResponse.json({ ok: true });
}
