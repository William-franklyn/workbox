import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: tasks } = await supabase
    .from("tasks")
    .select("id, title, status, priority, due_date, list_id, created_at")
    .order("created_at", { ascending: false })
    .limit(500);

  if (!tasks) return NextResponse.json({ total: 0, done: 0, inProgress: 0, inReview: 0, todo: 0, urgent: 0, overdue: 0, recent: [], dueToday: [], tasksByList: {} });

  const today = new Date().toISOString().slice(0, 10);

  const tasksByList: Record<string, number[]> = {};
  for (const t of tasks) {
    if (!tasksByList[t.list_id]) tasksByList[t.list_id] = [0, 0];
    tasksByList[t.list_id][0]++;
    if (t.status === "done") tasksByList[t.list_id][1]++;
  }

  return NextResponse.json({
    total: tasks.length,
    done: tasks.filter((t) => t.status === "done").length,
    inProgress: tasks.filter((t) => t.status === "in_progress").length,
    inReview: tasks.filter((t) => t.status === "in_review").length,
    todo: tasks.filter((t) => t.status === "todo").length,
    urgent: tasks.filter((t) => t.priority === "urgent" && t.status !== "done").length,
    overdue: tasks.filter((t) => t.due_date && t.due_date < today && t.status !== "done").length,
    recent: tasks.slice(0, 8),
    dueToday: tasks.filter((t) => t.due_date === today && t.status !== "done"),
    tasksByList, // { listId: [total, done] }
  });
}
