import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ connected: false });

  const { data } = await supabase
    .from("user_integrations")
    .select("email, updated_at")
    .eq("user_id", user.id)
    .eq("provider", "google_calendar")
    .maybeSingle();

  return NextResponse.json({ connected: !!data, email: data?.email ?? null });
}

export async function DELETE() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await supabase.from("user_integrations")
    .delete()
    .eq("user_id", user.id)
    .eq("provider", "google_calendar");

  return NextResponse.json({ ok: true });
}
