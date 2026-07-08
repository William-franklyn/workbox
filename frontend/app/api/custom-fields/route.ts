import { NextRequest, NextResponse } from "next/server";
import { requireOrg, requireAdmin } from "@/lib/auth/guard";
import { requireFeature } from "@/lib/billing/entitlements";

const FIELD_TYPES = ["text", "number", "select", "multi_select", "date", "checkbox", "url", "person"];

/** GET ?space_id= — field definitions for the org (optionally scoped to a space). */
export async function GET(req: NextRequest) {
  const auth = await requireOrg(req);
  if ("error" in auth) return auth.error;
  const { ctx } = auth;

  const spaceId = req.nextUrl.searchParams.get("space_id");
  let q = ctx.svc.from("custom_field_defs").select("*").eq("org_id", ctx.orgId).order("position");
  if (spaceId) q = q.or(`space_id.eq.${spaceId},space_id.is.null`);

  const { data } = await q;
  return NextResponse.json({ fields: data ?? [] });
}

/** POST { name, type, options?, space_id? } — create a field definition (admins). */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;
  const { ctx } = auth;

  const gateError = await requireFeature(ctx.svc, ctx.orgId, "customFields");
  if (gateError) return NextResponse.json({ error: gateError, code: "plan_limit" }, { status: 402 });

  const { name, type, options = [], space_id = null } = await req.json();
  if (!name?.trim() || !FIELD_TYPES.includes(type)) {
    return NextResponse.json({ error: `name and a valid type (${FIELD_TYPES.join(", ")}) are required` }, { status: 400 });
  }

  const { count } = await ctx.svc
    .from("custom_field_defs").select("id", { count: "exact", head: true }).eq("org_id", ctx.orgId);

  const { data, error } = await ctx.svc
    .from("custom_field_defs")
    .insert({ org_id: ctx.orgId, name: name.trim(), type, options, space_id, position: count ?? 0 })
    .select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ field: data }, { status: 201 });
}

/** PATCH { id, name?, options?, position? } */
export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;
  const { ctx } = auth;

  const { id, ...body } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if (typeof body.name === "string") patch.name = body.name.trim();
  if (Array.isArray(body.options)) patch.options = body.options;
  if (typeof body.position === "number") patch.position = body.position;

  const { data, error } = await ctx.svc
    .from("custom_field_defs").update(patch).eq("id", id).eq("org_id", ctx.orgId)
    .select().maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ field: data });
}

/** DELETE ?id= — remove definition (values on tasks remain but stop rendering). */
export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;
  const { ctx } = auth;

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  await ctx.svc.from("custom_field_defs").delete().eq("id", id).eq("org_id", ctx.orgId);
  return NextResponse.json({ ok: true });
}
