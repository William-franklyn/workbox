import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;
  const code = req.nextUrl.searchParams.get("code");
  const userId = req.nextUrl.searchParams.get("state");
  const error = req.nextUrl.searchParams.get("error");

  if (error || !code || !userId) {
    return NextResponse.redirect(`${appUrl}/integrations?error=microsoft_auth_failed`);
  }

  const tokenRes = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.MICROSOFT_CLIENT_ID!,
      client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
      redirect_uri: `${appUrl}/api/auth/microsoft/callback`,
      grant_type: "authorization_code",
      scope: "Calendars.ReadWrite User.Read offline_access openid email",
    }),
  });

  const tokens = await tokenRes.json();
  if (!tokens.access_token) {
    return NextResponse.redirect(`${appUrl}/integrations?error=token_exchange_failed`);
  }

  const userInfoRes = await fetch(
    "https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName",
    { headers: { Authorization: `Bearer ${tokens.access_token}` } }
  );
  const userInfo = await userInfoRes.json();

  const sb = createServiceClient();
  await sb.from("user_integrations").upsert(
    {
      user_id: userId,
      provider: "outlook_calendar",
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token ?? null,
      token_expires_at: new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString(),
      email: userInfo.mail ?? userInfo.userPrincipalName ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,provider" }
  );

  return NextResponse.redirect(`${appUrl}/meetings?outlook_connected=1`);
}
