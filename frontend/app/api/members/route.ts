import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("id, full_name, role, organization_id, created_at").eq("id", user.id).maybeSingle();

  if (!profile?.organization_id) {
    // Solo user — return just themselves so self-assignment works
    return NextResponse.json(profile ? [profile] : []);
  }

  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, role, created_at")
    .eq("organization_id", profile.organization_id)
    .order("created_at");

  // Always ensure current user is in the list
  const members = data ?? [];
  if (!members.find((m) => m.id === user.id)) members.unshift(profile);

  return NextResponse.json(members);
}
