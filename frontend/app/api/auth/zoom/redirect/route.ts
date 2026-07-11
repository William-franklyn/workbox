import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { zoomConfigured } from "@/lib/zoom/client";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_APP_URL));
  if (!zoomConfigured()) return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/integrations?error=zoom_not_configured`);

  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.ZOOM_CLIENT_ID!,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/zoom/callback`,
    state: user.id,
  });
  return NextResponse.redirect(`https://zoom.us/oauth/authorize?${params}`);
}
