import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const listId = req.nextUrl.searchParams.get("listId");
  if (!listId) return NextResponse.json({ error: "listId required" }, { status: 400 });

  const { data: tasks } = await supabase.from("tasks").select("id").eq("list_id", listId);
  if (!tasks?.length) return NextResponse.json({});

  const ids = tasks.map((t) => t.id);

  const [subtasksRes, commentsRes] = await Promise.all([
    supabase.from("subtasks").select("task_id").in("task_id", ids),
    supabase.from("task_comments").select("task_id").in("task_id", ids),
  ]);

  const counts: Record<string, { subtasks: number; comments: number }> = {};
  for (const id of ids) counts[id] = { subtasks: 0, comments: 0 };
  for (const row of subtasksRes.data ?? []) counts[row.task_id].subtasks++;
  for (const row of commentsRes.data ?? []) counts[row.task_id].comments++;

  return NextResponse.json(counts);
}
