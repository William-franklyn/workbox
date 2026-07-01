import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";

// GET  ?space_id=xxx → list permissions for a space
// POST { space_id, user_id, role } → set permission
// DELETE ?space_id=xxx&user_id=yyy → remove permission

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const svc = createServiceClient();
  const { searchParams } = new URL(req.url);
  const spaceId = searchParams.get("space_id");
  if (!spaceId) return NextResponse.json({ error: "space_id required" }, { status: 400 });

  const { data, error } = await svc.from("space_permissions")
    .select("*, profile:user_id(full_name, email, role)")
    .eq("space_id", spaceId);

  if (error) return NextResponse.json({ permissions: [] });
  return NextResponse.json({ permissions: data ?? [] });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const svc = createServiceClient();
  const body = await req.json();
  const { space_id, user_id, role } = body;
  if (!space_id || !user_id || !role) {
    return NextResponse.json({ error: "space_id, user_id, and role are required" }, { status: 400 });
  }

  const { data, error } = await svc.from("space_permissions")
    .upsert({ id: `sp${Date.now()}`, space_id, user_id, role }, { onConflict: "space_id,user_id" })
    .select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ permission: data });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const svc = createServiceClient();
  const { searchParams } = new URL(req.url);
  const spaceId = searchParams.get("space_id");
  const userId = searchParams.get("user_id");
  if (!spaceId || !userId) return NextResponse.json({ error: "space_id and user_id required" }, { status: 400 });

  await svc.from("space_permissions").delete().eq("space_id", spaceId).eq("user_id", userId);
  return NextResponse.json({ ok: true });
}
