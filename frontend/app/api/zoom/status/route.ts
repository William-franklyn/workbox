import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { zoomConfigured } from "@/lib/zoom/client";

/** GET /api/zoom/status — is the user's Zoom account connected? */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const svc = createServiceClient();
  const { data } = await svc.from("user_integrations")
    .select("email").eq("user_id", user.id).eq("provider", "zoom").maybeSingle();

  return NextResponse.json({ connected: !!data, email: data?.email ?? null, configured: zoomConfigured() });
}

/** DELETE — disconnect the user's Zoom account. */
export async function DELETE() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const svc = createServiceClient();
  await svc.from("user_integrations").delete().eq("user_id", user.id).eq("provider", "zoom");
  return NextResponse.json({ ok: true });
}
