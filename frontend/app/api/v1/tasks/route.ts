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

  let q = supabase
    .from("tasks")
    .select("id, title, status, priority, due_date, tags, list_id, position, created_at")
    .eq("org_id", orgId)
    .order("position", { ascending: true });

  if (listId)  q = q.eq("list_id", listId);
  if (status)  q = q.eq("status", status);
  if (due)     q = q.lte("due_date", due);

  if (spaceId && !listId) {
    const { data: lists } = await supabase.from("lists").select("id").eq("space_id", spaceId);
    const ids = (lists ?? []).map(l => l.id);
    if (ids.length === 0) return NextResponse.json({ tasks: [] });
    q = q.in("list_id", ids);
  }

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ tasks: data ?? [] });
}

export async function POST(req: NextRequest) {
  const userId = await validateApiKey(req.headers.get("authorization"));
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { title, list_id, status = "todo", priority = "normal", due_date, tags, description } = body;

  if (!title || !list_id) {
    return NextResponse.json({ error: "title and list_id are required" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data: profile } = await supabase
    .from("profiles").select("organization_id").eq("id", userId).maybeSingle();
  const orgId = profile?.organization_id;

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
      org_id: orgId,
      position: count ?? 0,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ task: data }, { status: 201 });
}

/** Batch create: POST /api/v1/tasks/batch  — handled here via ?batch=true */
