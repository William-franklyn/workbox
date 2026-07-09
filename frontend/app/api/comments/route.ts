import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const taskId = new URL(req.url).searchParams.get("taskId");
  if (!taskId) return NextResponse.json({ error: "taskId required" }, { status: 400 });

  // Manual profile join — there's no FK from task_comments to profiles, so a
  // PostgREST embed ("profiles(full_name)") fails with a schema-cache error.
  const { data, error } = await supabase
    .from("task_comments")
    .select("*")
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const rows = data ?? [];
  const userIds = [...new Set(rows.map(r => r.user_id).filter(Boolean))];
  const nameById = new Map<string, string>();
  if (userIds.length) {
    const { data: profiles } = await supabase
      .from("profiles").select("id, full_name").in("id", userIds);
    for (const p of profiles ?? []) nameById.set(p.id, p.full_name);
  }
  return NextResponse.json(rows.map(r => ({
    ...r,
    profiles: { full_name: nameById.get(r.user_id) ?? "Unknown" },
  })));
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { data, error } = await supabase
    .from("task_comments")
    .insert({ id: `c${Date.now()}`, ...body, user_id: user.id })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
  return NextResponse.json({ ...data, profiles: profile ?? null });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  const { error } = await supabase.from("task_comments").delete().eq("id", id).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
