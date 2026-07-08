import { NextRequest, NextResponse } from "next/server";
import { requireOrg, assertTaskInOrg } from "@/lib/auth/guard";

export async function GET(req: NextRequest) {
  const auth = await requireOrg(req);
  if ("error" in auth) return auth.error;
  const { ctx } = auth;

  const taskId = req.nextUrl.searchParams.get("task_id");
  if (!taskId) return NextResponse.json({ error: "task_id is required" }, { status: 400 });

  const taskErr = await assertTaskInOrg(ctx, taskId);
  if (taskErr) return taskErr;

  const { data } = await ctx.svc
    .from("task_subtasks")
    .select("id, title, completed, position, created_at")
    .eq("task_id", taskId)
    .order("position", { ascending: true });

  return NextResponse.json({ subtasks: data ?? [] });
}

export async function POST(req: NextRequest) {
  const auth = await requireOrg(req);
  if ("error" in auth) return auth.error;
  const { ctx } = auth;
  if (ctx.role === "guest") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { task_id, title } = await req.json();
  if (!task_id || !title) return NextResponse.json({ error: "task_id and title are required" }, { status: 400 });

  const taskErr = await assertTaskInOrg(ctx, task_id);
  if (taskErr) return taskErr;

  const { count } = await ctx.svc
    .from("task_subtasks").select("id", { count: "exact", head: true }).eq("task_id", task_id);

  const { data, error } = await ctx.svc
    .from("task_subtasks")
    .insert({ id: crypto.randomUUID(), task_id, title, completed: false, position: count ?? 0 })
    .select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ subtask: data }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireOrg(req);
  if ("error" in auth) return auth.error;
  const { ctx } = auth;
  if (ctx.role === "guest") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id, completed, title } = await req.json();
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if (completed !== undefined) patch.completed = completed;
  if (title !== undefined) patch.title = title;

  const { data, error } = await ctx.svc
    .from("task_subtasks").update(patch).eq("id", id).eq("org_id", ctx.orgId).select().maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ subtask: data });
}
