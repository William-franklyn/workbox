import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const task_id = new URL(req.url).searchParams.get("task_id");
  if (!task_id) return NextResponse.json({ error: "task_id required" }, { status: 400 });

  const service = createServiceClient();

  try {
    // Tasks that block this task (task_id depends_on these)
    const { data: blockedByRows, error: e1 } = await service
      .from("task_dependencies")
      .select("depends_on_id")
      .eq("task_id", task_id);

    if (e1) {
      // Table likely doesn't exist yet
      return NextResponse.json({ blocks: [], blocked_by: [] });
    }

    // Tasks that this task is blocking (they depend_on task_id)
    const { data: blocksRows, error: e2 } = await service
      .from("task_dependencies")
      .select("task_id")
      .eq("depends_on_id", task_id);

    if (e2) {
      return NextResponse.json({ blocks: [], blocked_by: [] });
    }

    const blockedByIds = (blockedByRows ?? []).map((r) => r.depends_on_id);
    const blocksIds = (blocksRows ?? []).map((r) => r.task_id);

    const fetchTasks = async (ids: string[]) => {
      if (!ids.length) return [];
      const { data } = await service.from("tasks").select("*").in("id", ids);
      return data ?? [];
    };

    const [blocked_by, blocks] = await Promise.all([
      fetchTasks(blockedByIds),
      fetchTasks(blocksIds),
    ]);

    return NextResponse.json({ blocks, blocked_by });
  } catch {
    return NextResponse.json({ blocks: [], blocked_by: [] });
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { task_id, depends_on_id } = await req.json();
  if (!task_id || !depends_on_id) {
    return NextResponse.json({ error: "task_id and depends_on_id required" }, { status: 400 });
  }
  if (task_id === depends_on_id) {
    return NextResponse.json({ error: "A task cannot depend on itself" }, { status: 400 });
  }

  const service = createServiceClient();
  try {
    const { data, error } = await service
      .from("task_dependencies")
      .insert({ task_id, depends_on_id })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Failed to create dependency" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const params = new URL(req.url).searchParams;
  const task_id = params.get("task_id");
  const depends_on_id = params.get("depends_on_id");

  if (!task_id || !depends_on_id) {
    return NextResponse.json({ error: "task_id and depends_on_id required" }, { status: 400 });
  }

  const service = createServiceClient();
  try {
    const { error } = await service
      .from("task_dependencies")
      .delete()
      .eq("task_id", task_id)
      .eq("depends_on_id", depends_on_id);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete dependency" }, { status: 500 });
  }
}
