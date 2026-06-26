import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("organization_id").eq("id", user.id).maybeSingle();
  if (!profile?.organization_id) return NextResponse.json([]);

  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, role, created_at")
    .eq("organization_id", profile.organization_id)
    .order("created_at");

  return NextResponse.json(data ?? []);
}
