import { NextRequest, NextResponse } from "next/server";
import { requireOrg, requireAdmin } from "@/lib/auth/guard";
import { checkGuestAvailable } from "@/lib/billing/entitlements";
import { randomBytes } from "crypto";

// GET  → list guest invites for the org (org members)
// POST → send guest invite (admins only)
// DELETE ?id=xxx → revoke invite (admins only, own org)

export async function GET(req: NextRequest) {
  const auth = await requireOrg(req);
  if ("error" in auth) return auth.error;
  const { ctx } = auth;

  const { data, error } = await ctx.svc.from("guest_invites")
    .select("*, inviter:invited_by(full_name)")
    .eq("org_id", ctx.orgId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ guests: [] });
  return NextResponse.json({ guests: data ?? [] });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;
  const { ctx } = auth;

  const body = await req.json();
  const { email, role = "guest", spaces = [] } = body;
  if (!email) return NextResponse.json({ error: "email is required" }, { status: 400 });

  const guestError = await checkGuestAvailable(ctx.svc, ctx.orgId);
  if (guestError) return NextResponse.json({ error: guestError, code: "plan_limit" }, { status: 402 });

  const token = randomBytes(32).toString("hex");
  const id = `gi${Date.now()}`;

  const { data, error } = await ctx.svc.from("guest_invites").insert({
    id, email, org_id: ctx.orgId, invited_by: ctx.userId, role, spaces, token,
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // In production: send invite email here
  const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/invite/${token}`;
  return NextResponse.json({ guest: data, invite_url: inviteUrl });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;
  const { ctx } = auth;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  await ctx.svc.from("guest_invites").delete().eq("id", id).eq("org_id", ctx.orgId);
  return NextResponse.json({ ok: true });
}
