import { NextRequest, NextResponse } from "next/server";
import { requireOrg, assertTaskInOrg } from "@/lib/auth/guard";

export async function GET(req: NextRequest) {
  const auth = await requireOrg(req);
  if ("error" in auth) return auth.error;
  const { ctx } = auth;
  const userId = ctx.userId;

  const { data } = await ctx.svc
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
  const auth = await requireOrg(req);
  if ("error" in auth) return auth.error;
  const { ctx } = auth;
  const userId = ctx.userId;

  const { task_id, duration_minutes, note } = await req.json();
  if (!task_id || !duration_minutes) return NextResponse.json({ error: "task_id and duration_minutes are required" }, { status: 400 });

  const taskErr = await assertTaskInOrg(ctx, task_id);
  if (taskErr) return taskErr;

  const { data, error } = await ctx.svc
    .from("time_logs")
    .insert({ id: crypto.randomUUID(), task_id, user_id: userId, duration_minutes, note: note ?? null })
    .select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ time_log: data }, { status: 201 });
}
