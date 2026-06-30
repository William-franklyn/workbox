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
    .from("task_comments")
    .select("id, content, user_id, created_at")
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });

  return NextResponse.json({ comments: data ?? [] });
}

export async function POST(req: NextRequest) {
  const userId = await validateApiKey(req.headers.get("authorization"));
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { task_id, content } = await req.json();
  if (!task_id || !content) return NextResponse.json({ error: "task_id and content are required" }, { status: 400 });

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("task_comments")
    .insert({ id: crypto.randomUUID(), task_id, user_id: userId, content })
    .select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ comment: data }, { status: 201 });
}
