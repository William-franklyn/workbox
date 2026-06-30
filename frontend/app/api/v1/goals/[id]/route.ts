import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-key";
import { createServiceClient } from "@/lib/supabase/server";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await validateApiKey(req.headers.get("authorization"));
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const supabase = createServiceClient();

  // Update key result progress if kr_id provided
  if (body.kr_id !== undefined) {
    const { data, error } = await supabase
      .from("key_results")
      .update({ current_value: body.current_value })
      .eq("id", body.kr_id).eq("goal_id", id)
      .select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ key_result: data });
  }

  // Update goal itself
  const allowed = ["title", "description", "due_date"];
  const patch: Record<string, unknown> = {};
  for (const k of allowed) { if (k in body) patch[k] = body[k]; }

  const { data, error } = await supabase
    .from("goals").update(patch).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ goal: data });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await validateApiKey(req.headers.get("authorization"));
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const supabase = createServiceClient();
  await supabase.from("goals").delete().eq("id", id);
  return NextResponse.json({ ok: true });
}
