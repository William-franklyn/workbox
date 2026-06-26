import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  const supabase = await createClient();

  if (code) {
    await supabase.auth.exchangeCodeForSession(code);
  } else if (token_hash && type) {
    await supabase.auth.verifyOtp({ token_hash, type: type as any });
  }

  // After auth: check if the user already has a profile/org_id
  // If they're a new invited user, send to onboarding; otherwise home
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data: profile } = await supabase.from("profiles").select("organization_id").eq("id", user.id).single();
    if (!profile?.organization_id) {
      return NextResponse.redirect(`${origin}/onboarding`);
    }
    return NextResponse.redirect(`${origin}/home`);
  }

  return NextResponse.redirect(`${origin}/login`);
}
