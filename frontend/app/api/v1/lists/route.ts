import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-key";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const userId = await validateApiKey(req.headers.get("authorization"));
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, space_id, color = "#7c3aed" } = await req.json();
  if (!name || !space_id) return NextResponse.json({ error: "name and space_id are required" }, { status: 400 });

  const supabase = createServiceClient();
  const { count } = await supabase
    .from("lists").select("id", { count: "exact", head: true }).eq("space_id", space_id);

  const { data, error } = await supabase
    .from("lists")
    .insert({ id: `l${Date.now()}`, name, space_id, color, position: count ?? 0 })
    .select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ list: data }, { status: 201 });
}
