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
    .from("task_comments")
    .select("id, content, user_id, created_at")
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });

  return NextResponse.json({ comments: data ?? [] });
}

export async function POST(req: NextRequest) {
  const auth = await requireOrg(req);
  if ("error" in auth) return auth.error;
  const { ctx } = auth;
  if (ctx.role === "guest") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { task_id, content } = await req.json();
  if (!task_id || !content) return NextResponse.json({ error: "task_id and content are required" }, { status: 400 });

  const taskErr = await assertTaskInOrg(ctx, task_id);
  if (taskErr) return taskErr;

  const { data, error } = await ctx.svc
    .from("task_comments")
    .insert({ id: crypto.randomUUID(), task_id, user_id: ctx.userId, content })
    .select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ comment: data }, { status: 201 });
}
