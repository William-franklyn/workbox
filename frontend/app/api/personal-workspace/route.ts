import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id, full_name")
    .eq("id", user.id)
    .maybeSingle();

  const orgId = profile?.organization_id;
  if (!orgId) return NextResponse.json({ error: "No org" }, { status: 400 });

  // Find or create personal space (each user's personal space is named "My Workspace")
  let { data: space } = await supabase
    .from("spaces")
    .select("*")
    .eq("org_id", orgId)
    .eq("name", "My Workspace")
    .maybeSingle();

  if (!space) {
    const { data: newSpace } = await supabase.from("spaces").insert({
      id: crypto.randomUUID(),
      name: "My Workspace",
      org_id: orgId,
      icon: "🏠",
      color: "#7c3aed",
      position: -1,
    }).select().single();
    space = newSpace;
  }

  if (!space) return NextResponse.json({ error: "Failed to create personal space" }, { status: 500 });

  // Find or create "My Tasks" list in personal space
  let { data: list } = await supabase
    .from("lists")
    .select("*")
    .eq("space_id", space.id)
    .eq("name", "My Tasks")
    .maybeSingle();

  if (!list) {
    const { data: newList } = await supabase.from("lists").insert({
      id: crypto.randomUUID(),
      name: "My Tasks",
      space_id: space.id,
      position: 0,
    }).select().single();
    list = newList;
  }

  return NextResponse.json({ space, list });
}
