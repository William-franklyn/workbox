import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-key";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const userId = await validateApiKey(req.headers.get("authorization"));
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createServiceClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", userId)
    .maybeSingle();

  const orgId = profile?.organization_id;
  if (!orgId) return NextResponse.json({ spaces: [] });

  const { data: spaces } = await supabase
    .from("spaces")
    .select("id, name, position")
    .eq("org_id", orgId)
    .order("position", { ascending: true });

  const spaceIds = (spaces ?? []).map(s => s.id);
  const { data: lists } = spaceIds.length
    ? await supabase
        .from("lists")
        .select("id, name, space_id, position")
        .in("space_id", spaceIds)
        .order("position", { ascending: true })
    : { data: [] };

  const result = (spaces ?? []).map(s => ({
    ...s,
    lists: (lists ?? []).filter(l => l.space_id === s.id),
  }));

  return NextResponse.json({ spaces: result });
}

export async function POST(req: NextRequest) {
  const userId = await validateApiKey(req.headers.get("authorization"));
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, icon = "🚀", color = "#7c3aed" } = await req.json();
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const supabase = createServiceClient();
  const { data: profile } = await supabase
    .from("profiles").select("organization_id").eq("id", userId).maybeSingle();

  const { count } = await supabase
    .from("spaces").select("id", { count: "exact", head: true }).eq("org_id", profile?.organization_id ?? "");

  const { data, error } = await supabase
    .from("spaces")
    .insert({ id: `s${Date.now()}`, name, icon, color, org_id: profile?.organization_id, position: count ?? 0 })
    .select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ space: data }, { status: 201 });
}
