import { NextRequest, NextResponse } from "next/server";
import { requireOrg, requireAdmin } from "@/lib/auth/guard";
import { checkAutomationAvailable } from "@/lib/billing/entitlements";

export async function GET(req: NextRequest) {
  const auth = await requireOrg(req);
  if ("error" in auth) return auth.error;
  const { ctx } = auth;

  const { data, error } = await ctx.svc
    .from("automations").select("*")
    .eq("org_id", ctx.orgId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ automations: [] });
  return NextResponse.json({ automations: data ?? [] });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;
  const { ctx } = auth;

  const body = await req.json();
  const { name, trigger_type, trigger_value, action_type, action_value } = body;
  if (!name || !trigger_type || !action_type) {
    return NextResponse.json({ error: "name, trigger_type and action_type are required" }, { status: 400 });
  }

  const limitError = await checkAutomationAvailable(ctx.svc, ctx.orgId);
  if (limitError) return NextResponse.json({ error: limitError, code: "plan_limit" }, { status: 402 });

  const id = `auto${Date.now()}`;
  const { data, error } = await ctx.svc.from("automations").insert({
    id, name, trigger_type, trigger_value: trigger_value ?? "", action_type, action_value: action_value ?? "",
    org_id: ctx.orgId, enabled: true, run_count: 0,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ automation: data });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;
  const { ctx } = auth;

  const body = await req.json();
  const { id, ...updates } = body;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  delete updates.org_id; // org can never be reassigned

  const { data, error } = await ctx.svc
    .from("automations").update(updates).eq("id", id).eq("org_id", ctx.orgId)
    .select().maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ automation: data });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;
  const { ctx } = auth;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  await ctx.svc.from("automations").delete().eq("id", id).eq("org_id", ctx.orgId);
  return NextResponse.json({ ok: true });
}
