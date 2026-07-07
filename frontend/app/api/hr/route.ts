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
  const type = req.nextUrl.searchParams.get("type") ?? "employees";

  if (type === "employees") {
    let q = svc.from("hr_employees").select("*, manager:hr_employees!manager_id(id,full_name,job_title)").order("full_name");
    if (orgId) q = q.eq("org_id", orgId);
    const { data } = await q;
    return NextResponse.json(data ?? []);
  }
  if (type === "leave") {
    let q = svc.from("hr_leave_requests").select("*, employee:hr_employees(id,full_name,department,job_title)").order("created_at", { ascending: false });
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
  const { type, ...body } = await req.json();

  if (type === "leave") {
    const { data, error } = await svc.from("hr_leave_requests").insert({ ...body, org_id: orgId }).select("*, employee:hr_employees(id,full_name,department,job_title)").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data);
  }

  const { data, error } = await svc.from("hr_employees").insert({ ...body, org_id: orgId }).select().single();
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
  const table = type === "leave" ? "hr_leave_requests" : "hr_employees";
  const patch = type === "leave" ? updates : { ...updates, updated_at: new Date().toISOString() };
  const { data, error } = await svc.from(table).update(patch).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const svc = createServiceClient();
  const id = req.nextUrl.searchParams.get("id");
  const type = req.nextUrl.searchParams.get("type") ?? "employee";
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const table = type === "leave" ? "hr_leave_requests" : "hr_employees";
  await svc.from(table).delete().eq("id", id);
  return NextResponse.json({ ok: true });
}
