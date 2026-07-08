import { NextRequest, NextResponse } from "next/server";
import { requireOrg, requireAdmin, assertSpaceInOrg } from "@/lib/auth/guard";

// GET  ?space_id=xxx → list permissions for a space (org members)
// POST { space_id, user_id, role } → set permission (admins only)
// DELETE ?space_id=xxx&user_id=yyy → remove permission (admins only)

export async function GET(req: NextRequest) {
  const auth = await requireOrg(req);
  if ("error" in auth) return auth.error;
  const { ctx } = auth;

  const { searchParams } = new URL(req.url);
  const spaceId = searchParams.get("space_id");
  if (!spaceId) return NextResponse.json({ error: "space_id required" }, { status: 400 });

  const spaceErr = await assertSpaceInOrg(ctx, spaceId);
  if (spaceErr) return spaceErr;

  const { data, error } = await ctx.svc.from("space_permissions")
    .select("*, profile:user_id(full_name, email, role)")
    .eq("space_id", spaceId);

  if (error) return NextResponse.json({ permissions: [] });
  return NextResponse.json({ permissions: data ?? [] });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;
  const { ctx } = auth;

  const body = await req.json();
  const { space_id, user_id, role } = body;
  if (!space_id || !user_id || !role) {
    return NextResponse.json({ error: "space_id, user_id, and role are required" }, { status: 400 });
  }

  const spaceErr = await assertSpaceInOrg(ctx, space_id);
  if (spaceErr) return spaceErr;

  // The target user must belong to this org too
  const { data: target } = await ctx.svc.from("profiles")
    .select("organization_id").eq("id", user_id).maybeSingle();
  if (target?.organization_id !== ctx.orgId) {
    return NextResponse.json({ error: "User not in organization" }, { status: 404 });
  }

  const { data, error } = await ctx.svc.from("space_permissions")
    .upsert({ id: `sp${Date.now()}`, space_id, user_id, role }, { onConflict: "space_id,user_id" })
    .select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ permission: data });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;
  const { ctx } = auth;

  const { searchParams } = new URL(req.url);
  const spaceId = searchParams.get("space_id");
  const userId = searchParams.get("user_id");
  if (!spaceId || !userId) return NextResponse.json({ error: "space_id and user_id required" }, { status: 400 });

  const spaceErr = await assertSpaceInOrg(ctx, spaceId);
  if (spaceErr) return spaceErr;

  await ctx.svc.from("space_permissions").delete().eq("space_id", spaceId).eq("user_id", userId);
  return NextResponse.json({ ok: true });
}
