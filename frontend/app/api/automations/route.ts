import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const svc = createServiceClient();
  const { data: profile } = await svc.from("profiles").select("organization_id").eq("id", user.id).maybeSingle();
  const orgId = (profile as any)?.organization_id ?? null;

  let q = svc.from("automations").select("*").order("created_at", { ascending: false });
  if (orgId) q = (q as any).eq("org_id", orgId);
  else q = (q as any).eq("org_id", user.id); // fallback: use user id as org

  const { data, error } = await q;
  if (error) return NextResponse.json({ automations: [] });
  return NextResponse.json({ automations: data ?? [] });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const svc = createServiceClient();
  const { data: profile } = await svc.from("profiles").select("organization_id").eq("id", user.id).maybeSingle();
  const orgId = (profile as any)?.organization_id ?? user.id;

  const body = await req.json();
  const { name, trigger_type, trigger_value, action_type, action_value } = body;
  if (!name || !trigger_type || !action_type) {
    return NextResponse.json({ error: "name, trigger_type and action_type are required" }, { status: 400 });
  }

  const id = `auto${Date.now()}`;
  const { data, error } = await svc.from("automations").insert({
    id, name, trigger_type, trigger_value: trigger_value ?? "", action_type, action_value: action_value ?? "",
    org_id: orgId, enabled: true, run_count: 0,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ automation: data });
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const svc = createServiceClient();
  const body = await req.json();
  const { id, ...updates } = body;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { data, error } = await svc.from("automations").update(updates).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ automation: data });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const svc = createServiceClient();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  await svc.from("automations").delete().eq("id", id);
  return NextResponse.json({ ok: true });
}
