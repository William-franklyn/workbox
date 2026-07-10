import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { createClient as createBareClient } from "@supabase/supabase-js";

/**
 * Email verification via Supabase's built-in mailer (free).
 *
 * POST { action: "send" }            — email a 6-digit OTP to the account email
 * POST { action: "confirm", token }  — verify the code server-side, then set
 *                                      profiles.email_verified
 * GET                                — current status
 *
 * The OTP is verified with supabase.auth.verifyOtp on the server, so the flag
 * can't be set by a client that never completed the round-trip. Requires the
 * Supabase "Magic Link" email template to include {{ .Token }}.
 */

function bareAnon() {
  return createBareClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles")
    .select("email_verified").eq("id", user.id).maybeSingle();
  return NextResponse.json({
    email: user.email,
    email_verified: profile?.email_verified ?? false,
  });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { action, token } = await req.json();

  if (action === "send") {
    const { error } = await bareAnon().auth.signInWithOtp({
      email: user.email,
      options: { shouldCreateUser: false },
    });
    if (error) {
      const friendly = /rate limit/i.test(error.message)
        ? "Too many emails sent recently — Supabase's free mailer is rate-limited. Try again in an hour."
        : error.message;
      return NextResponse.json({ error: friendly }, { status: 429 });
    }
    return NextResponse.json({ ok: true, sent_to: user.email });
  }

  if (action === "confirm") {
    if (!token || !/^\d{6}$/.test(String(token))) {
      return NextResponse.json({ error: "Enter the 6-digit code from the email." }, { status: 400 });
    }
    const { error } = await bareAnon().auth.verifyOtp({
      email: user.email,
      token: String(token),
      type: "email",
    });
    if (error) {
      return NextResponse.json({ error: "Invalid or expired code. Request a new one." }, { status: 400 });
    }
    const admin = createServiceClient();
    const { error: updErr } = await admin.from("profiles")
      .update({ email_verified: true }).eq("id", user.id);
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });
    return NextResponse.json({ ok: true, email_verified: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
