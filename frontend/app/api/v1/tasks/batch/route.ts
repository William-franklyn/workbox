import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-key";
import { createServiceClient } from "@/lib/supabase/server";

interface TaskInput {
  title: string;
  list_id: string;
  status?: string;
  priority?: string;
  due_date?: string;
  tags?: string[];
  description?: string;
}

/** POST /api/v1/tasks/batch — create multiple tasks in one request.
 *  Body: { tasks: TaskInput[] }
 *  Used by MCP "create_plan" to push an entire week plan at once.
 */
export async function POST(req: NextRequest) {
  const userId = await validateApiKey(req.headers.get("authorization"));
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const tasks: TaskInput[] = body.tasks ?? [];
  if (!tasks.length) return NextResponse.json({ error: "tasks array is required" }, { status: 400 });

  const supabase = createServiceClient();
  const { data: profile } = await supabase
    .from("profiles").select("organization_id").eq("id", userId).maybeSingle();
  const orgId = profile?.organization_id;

  const rows = tasks.map((t, i) => ({
    id: crypto.randomUUID(),
    title: t.title,
    list_id: t.list_id,
    status: t.status ?? "todo",
    priority: t.priority ?? "normal",
    due_date: t.due_date ?? null,
    tags: t.tags ?? [],
    description: t.description ?? null,
    created_by: userId,
    position: i,
    created_at: new Date().toISOString(),
  }));

  const { data, error } = await supabase.from("tasks").insert(rows).select();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ tasks: data, created: data?.length ?? 0 }, { status: 201 });
}
