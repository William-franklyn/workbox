import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-key";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const userId = await validateApiKey(req.headers.get("authorization"));
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const taskId = req.nextUrl.searchParams.get("task_id");
  if (!taskId) return NextResponse.json({ error: "task_id is required" }, { status: 400 });

  const supabase = createServiceClient();
  const { data } = await supabase
    .from("task_subtasks")
    .select("id, title, completed, position, created_at")
    .eq("task_id", taskId)
    .order("position", { ascending: true });

  return NextResponse.json({ subtasks: data ?? [] });
}

export async function POST(req: NextRequest) {
  const userId = await validateApiKey(req.headers.get("authorization"));
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { task_id, title } = await req.json();
  if (!task_id || !title) return NextResponse.json({ error: "task_id and title are required" }, { status: 400 });

  const supabase = createServiceClient();
  const { count } = await supabase
    .from("task_subtasks").select("id", { count: "exact", head: true }).eq("task_id", task_id);

  const { data, error } = await supabase
    .from("task_subtasks")
    .insert({ id: crypto.randomUUID(), task_id, title, completed: false, position: count ?? 0 })
    .select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ subtask: data }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const userId = await validateApiKey(req.headers.get("authorization"));
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, completed, title } = await req.json();
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const supabase = createServiceClient();
  const patch: Record<string, unknown> = {};
  if (completed !== undefined) patch.completed = completed;
  if (title !== undefined) patch.title = title;

  const { data, error } = await supabase
    .from("task_subtasks").update(patch).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ subtask: data });
}
