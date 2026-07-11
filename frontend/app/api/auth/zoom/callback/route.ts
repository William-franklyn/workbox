import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;
  const code = req.nextUrl.searchParams.get("code");
  const userId = req.nextUrl.searchParams.get("state");
  const error = req.nextUrl.searchParams.get("error");

  if (error || !code || !userId) {
    return NextResponse.redirect(`${appUrl}/integrations?error=zoom_auth_failed`);
  }

  const basic = Buffer.from(`${process.env.ZOOM_CLIENT_ID}:${process.env.ZOOM_CLIENT_SECRET}`).toString("base64");
  const tokenRes = await fetch("https://zoom.us/oauth/token", {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: `${appUrl}/api/auth/zoom/callback`,
    }),
  });
  const tokens = await tokenRes.json();
  if (!tokens.access_token) {
    return NextResponse.redirect(`${appUrl}/integrations?error=zoom_token_failed`);
  }

  // Fetch the Zoom account email for display
  let email: string | null = null;
  try {
    const me = await fetch("https://api.zoom.us/v2/users/me", { headers: { Authorization: `Bearer ${tokens.access_token}` } }).then(r => r.json());
    email = me.email ?? null;
  } catch { /* ignore */ }

  const sb = createServiceClient();
  await sb.from("user_integrations").upsert(
    {
      user_id: userId,
      provider: "zoom",
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token ?? null,
      token_expires_at: new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString(),
      email,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,provider" },
  );

  return NextResponse.redirect(`${appUrl}/integrations?zoom=connected`);
}
