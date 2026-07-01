import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const svc = createServiceClient();
  const { data: profile } = await svc.from("profiles").select("organization_id").eq("id", user.id).maybeSingle();
  const orgId = profile?.organization_id ?? null;

  let query = svc.from("forms").select("*, target_list:lists(id, name)").order("created_at", { ascending: false });
  if (orgId) {
    query = query.eq("org_id", orgId);
  } else {
    query = query.eq("created_by", user.id);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const svc = createServiceClient();
  const { data: profile } = await svc.from("profiles").select("organization_id").eq("id", user.id).maybeSingle();
  const orgId = profile?.organization_id ?? null;

  const body = await req.json();
  const { name, description, target_list_id, fields, default_status, default_priority } = body;

  const { data, error } = await svc.from("forms").insert({
    name: name ?? "Untitled Form",
    description: description ?? null,
    org_id: orgId,
    created_by: user.id,
    target_list_id: target_list_id ?? null,
    fields: fields ?? [],
    default_status: default_status ?? "todo",
    default_priority: default_priority ?? "normal",
  }).select("*, target_list:lists(id, name)").single();

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

  const { data, error } = await svc.from("forms").update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*, target_list:lists(id, name)")
    .single();

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

  const { error } = await svc.from("forms").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
