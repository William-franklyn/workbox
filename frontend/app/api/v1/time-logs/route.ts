import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-key";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const userId = await validateApiKey(req.headers.get("authorization"));
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createServiceClient();
  const { data } = await supabase
    .from("time_logs")
    .select("id, task_id, duration_minutes, note, logged_at")
    .eq("user_id", userId)
    .order("logged_at", { ascending: false })
    .limit(100);

  const total = (data ?? []).reduce((sum, t) => sum + (t.duration_minutes ?? 0), 0);

  return NextResponse.json({
    time_logs: data ?? [],
    total_minutes: total,
    total_hours: Math.round((total / 60) * 10) / 10,
  });
}

export async function POST(req: NextRequest) {
  const userId = await validateApiKey(req.headers.get("authorization"));
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { task_id, duration_minutes, note } = await req.json();
  if (!task_id || !duration_minutes) return NextResponse.json({ error: "task_id and duration_minutes are required" }, { status: 400 });

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("time_logs")
    .insert({ id: crypto.randomUUID(), task_id, user_id: userId, duration_minutes, note: note ?? null })
    .select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ time_log: data }, { status: 201 });
}
