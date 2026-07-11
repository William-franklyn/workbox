import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

const COLORS = ["yellow", "pink", "blue", "green", "purple", "orange"];

async function uid() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

/** GET — the caller's sticky notes. */
export async function GET() {
  const userId = await uid();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const svc = createServiceClient();
  const { data } = await svc.from("sticky_notes").select("*").eq("user_id", userId).order("created_at");
  return NextResponse.json(data ?? []);
}

/** POST — create a note. */
export async function POST(req: NextRequest) {
  const userId = await uid();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const svc = createServiceClient();
  const { data: profile } = await svc.from("profiles").select("organization_id").eq("id", userId).maybeSingle();
  const body = await req.json();
  const color = COLORS.includes(body.color) ? body.color : "yellow";
  const { data, error } = await svc.from("sticky_notes").insert({
    user_id: userId, org_id: profile?.organization_id ?? null,
    content: body.content ?? "", color,
    x: Number.isFinite(body.x) ? body.x : 40, y: Number.isFinite(body.y) ? body.y : 40,
    remind_at: body.remind_at || null,
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}

/** PATCH — update content / color / position / reminder. */
export async function PATCH(req: NextRequest) {
  const userId = await uid();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const svc = createServiceClient();
  const { id, ...rest } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof rest.content === "string") patch.content = rest.content;
  if (COLORS.includes(rest.color)) patch.color = rest.color;
  if (Number.isFinite(rest.x)) patch.x = rest.x;
  if (Number.isFinite(rest.y)) patch.y = rest.y;
  if ("remind_at" in rest) patch.remind_at = rest.remind_at || null;

  // Ownership enforced by matching user_id in the update filter
  const { data, error } = await svc.from("sticky_notes").update(patch).eq("id", id).eq("user_id", userId).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}

/** DELETE — remove a note. */
export async function DELETE(req: NextRequest) {
  const userId = await uid();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const svc = createServiceClient();
  const { id } = await req.json();
  await svc.from("sticky_notes").delete().eq("id", id).eq("user_id", userId);
  return NextResponse.json({ ok: true });
}
