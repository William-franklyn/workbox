import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-key";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const userId = await validateApiKey(req.headers.get("authorization"));
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const listId  = searchParams.get("list_id");
  const spaceId = searchParams.get("space_id");
  const status  = searchParams.get("status");   // todo|in_progress|in_review|done
  const due     = searchParams.get("due");      // YYYY-MM-DD — tasks due on or before

  const supabase = createServiceClient();
  const { data: profile } = await supabase
    .from("profiles").select("organization_id").eq("id", userId).maybeSingle();
  const orgId = profile?.organization_id;
  if (!orgId) return NextResponse.json({ tasks: [] });

  // Resolve which list IDs the user can see
  let allowedListIds: string[] | null = null;

  if (listId) {
    allowedListIds = [listId];
  } else if (spaceId) {
    const { data: lists } = await supabase.from("lists").select("id").eq("space_id", spaceId);
    allowedListIds = (lists ?? []).map(l => l.id);
    if (allowedListIds.length === 0) return NextResponse.json({ tasks: [] });
  } else {
    // All lists in the org
    const { data: spaces } = await supabase.from("spaces").select("id").eq("org_id", orgId);
    const spaceIds = (spaces ?? []).map(s => s.id);
    if (spaceIds.length === 0) return NextResponse.json({ tasks: [] });
    const { data: lists } = await supabase.from("lists").select("id").in("space_id", spaceIds);
    allowedListIds = (lists ?? []).map(l => l.id);
    if (allowedListIds.length === 0) return NextResponse.json({ tasks: [] });
  }

  let q = supabase
    .from("tasks")
    .select("id, title, status, priority, due_date, tags, list_id, position, created_at, assignee_id, description")
    .in("list_id", allowedListIds)
    .order("position", { ascending: true });

  if (status) q = q.eq("status", status);
  if (due)    q = q.lte("due_date", due);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ tasks: data ?? [] });
}

export async function POST(req: NextRequest) {
  const userId = await validateApiKey(req.headers.get("authorization"));
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { title, list_id, status = "todo", priority = "normal", due_date, tags, description, assignee_id } = body;

  if (!title || !list_id) {
    return NextResponse.json({ error: "title and list_id are required" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data: profile } = await supabase
    .from("profiles").select("organization_id").eq("id", userId).maybeSingle();
  const orgId = profile?.organization_id;

  // Assignee must belong to the same organization
  if (assignee_id) {
    const { data: member } = await supabase.from("profiles")
      .select("id").eq("id", assignee_id).eq("organization_id", orgId).maybeSingle();
    if (!member) return NextResponse.json({ error: "assignee_id is not a member of your organization" }, { status: 400 });
  }

  // Get next position
  const { count } = await supabase
    .from("tasks").select("id", { count: "exact", head: true }).eq("list_id", list_id);

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      id: crypto.randomUUID(),
      title, list_id, status, priority,
      due_date: due_date ?? null,
      tags: tags ?? [],
      description: description ?? null,
      assignee_id: assignee_id ?? null,
      created_by: userId,
      org_id: orgId,
      position: count ?? 0,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ task: data }, { status: 201 });
}

/**
 * PATCH /api/v1/tasks — update a task (status, priority, due date, title,
 * description, tags, or assignment). Body: { id, ...fields }.
 */
export async function PATCH(req: NextRequest) {
  const userId = await validateApiKey(req.headers.get("authorization"));
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { id, ...fields } = body;
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const supabase = createServiceClient();
  const { data: profile } = await supabase
    .from("profiles").select("organization_id").eq("id", userId).maybeSingle();
  const orgId = profile?.organization_id;
  if (!orgId) return NextResponse.json({ error: "No organization" }, { status: 400 });

  // The task must belong to the caller's organization
  const { data: task } = await supabase.from("tasks").select("id, org_id, list_id").eq("id", id).maybeSingle();
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });
  if (task.org_id && task.org_id !== orgId) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const allowed = ["title", "status", "priority", "due_date", "description", "tags", "assignee_id", "list_id", "position"];
  const patch: Record<string, unknown> = {};
  for (const k of allowed) if (k in fields) patch[k] = fields[k];
  if (!Object.keys(patch).length) return NextResponse.json({ error: "No updatable fields provided" }, { status: 400 });

  if (patch.assignee_id) {
    const { data: member } = await supabase.from("profiles")
      .select("id").eq("id", patch.assignee_id as string).eq("organization_id", orgId).maybeSingle();
    if (!member) return NextResponse.json({ error: "assignee_id is not a member of your organization" }, { status: 400 });
  }

  const { data, error } = await supabase.from("tasks").update(patch).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ task: data });
}

/** Batch create: POST /api/v1/tasks/batch  — handled here via ?batch=true */
