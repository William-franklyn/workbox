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

  const { data: lists } = await supabase
    .from("lists")
    .select("id, name, space_id, position")
    .eq("org_id", orgId)
    .order("position", { ascending: true });

  const result = (spaces ?? []).map(s => ({
    ...s,
    lists: (lists ?? []).filter(l => l.space_id === s.id),
  }));

  return NextResponse.json({ spaces: result });
}
