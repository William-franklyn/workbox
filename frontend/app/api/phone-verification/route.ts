import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import crypto from "crypto";

/**
 * WhatsApp phone verification — reverse OTP.
 *
 * POST — generate a one-time code the user sends TO the bot ("VERIFY 123456").
 *        The webhook binds the sender's WhatsApp number (attested by WhatsApp
 *        itself) to this account. Free: the message is user-initiated.
 * GET  — poll current phone status while the Settings modal is open.
 * DELETE — unlink the phone number.
 */

const CODE_TTL_MIN = 15;

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createServiceClient();

  // Invalidate any previous pending codes for this user
  await admin.from("phone_verifications").update({ used_at: new Date().toISOString() })
    .eq("user_id", user.id).is("used_at", null);

  const code = crypto.randomInt(100000, 999999).toString();
  const { error } = await admin.from("phone_verifications").insert({
    user_id: user.id,
    code,
    expires_at: new Date(Date.now() + CODE_TTL_MIN * 60 * 1000).toISOString(),
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const botNumber = process.env.NEXT_PUBLIC_WHATSAPP_BOT_NUMBER ?? "";
  return NextResponse.json({
    code,
    expires_in_minutes: CODE_TTL_MIN,
    bot_number: botNumber,
    wa_link: botNumber
      ? `https://wa.me/${botNumber}?text=${encodeURIComponent(`VERIFY ${code}`)}`
      : null,
  });
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles")
    .select("phone_number, phone_verified").eq("id", user.id).maybeSingle();
  return NextResponse.json({
    phone_number: profile?.phone_number ?? null,
    phone_verified: profile?.phone_verified ?? false,
  });
}

export async function DELETE() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabase.from("profiles")
    .update({ phone_number: null, phone_verified: false }).eq("id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
