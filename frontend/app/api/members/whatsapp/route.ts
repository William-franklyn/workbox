import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";

/**
 * Admin onboarding of a teammate to the WhatsApp bot.
 * POST   { user_id, phone } — link + verify a member's WhatsApp number so they
 *                             can message the bot immediately (admin vouches
 *                             for the number, so it skips the self-serve OTP).
 * DELETE { user_id }        — unlink a member's WhatsApp.
 * Admin/owner only, org-scoped, via the service role (which the migration-025
 * trigger permits to set phone_verified).
 */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;
  const { ctx } = auth;

  const { user_id, phone } = await req.json();
  if (!user_id || !phone) return NextResponse.json({ error: "user_id and phone are required" }, { status: 400 });

  // Normalise to E.164-ish (+digits)
  const normalized = "+" + String(phone).replace(/[^\d]/g, "");
  if (normalized.length < 8) return NextResponse.json({ error: "Enter a valid phone number with country code" }, { status: 400 });

  // Target must be a member of this org
  const { data: target } = await ctx.svc.from("profiles")
    .select("id, organization_id").eq("id", user_id).maybeSingle();
  if (!target || target.organization_id !== ctx.orgId) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  // Number must not already belong to another account
  const { data: holder } = await ctx.svc.from("profiles")
    .select("id").eq("phone_number", normalized).maybeSingle();
  if (holder && holder.id !== user_id) {
    return NextResponse.json({ error: "That number is already linked to another account." }, { status: 409 });
  }

  const { error } = await ctx.svc.from("profiles")
    .update({ phone_number: normalized, phone_verified: true }).eq("id", user_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true, phone: normalized });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;
  const { ctx } = auth;

  const { user_id } = await req.json();
  if (!user_id) return NextResponse.json({ error: "user_id required" }, { status: 400 });

  const { data: target } = await ctx.svc.from("profiles").select("organization_id").eq("id", user_id).maybeSingle();
  if (!target || target.organization_id !== ctx.orgId) return NextResponse.json({ error: "Member not found" }, { status: 404 });

  await ctx.svc.from("profiles").update({ phone_number: null, phone_verified: false }).eq("id", user_id);
  return NextResponse.json({ ok: true });
}
