import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdmin } from "@supabase/supabase-js";

function adminClient() {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Member submits an extension request
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { task_id, message, days_requested } = await req.json();
  if (!task_id) return NextResponse.json({ error: "task_id required" }, { status: 400 });

  const { data, error } = await supabase.from("extension_requests").insert({
    id: `er${Date.now()}`,
    task_id,
    requested_by: user.id,
    message: message ?? null,
    days_requested: days_requested ?? 1,
    status: "pending",
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}

// Admin fetches requests for a task
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const task_id = req.nextUrl.searchParams.get("taskId");
  if (!task_id) return NextResponse.json({ error: "taskId required" }, { status: 400 });

  const admin = adminClient();
  // Manual profile join — there's no FK from extension_requests to profiles,
  // so a PostgREST embed ("profiles(full_name)") fails with a schema-cache error.
  const { data, error } = await admin
    .from("extension_requests")
    .select("*")
    .eq("task_id", task_id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const rows = data ?? [];
  const userIds = [...new Set(rows.map(r => r.requested_by).filter(Boolean))];
  const nameById = new Map<string, string>();
  if (userIds.length) {
    const { data: profiles } = await admin
      .from("profiles").select("id, full_name").in("id", userIds);
    for (const p of profiles ?? []) nameById.set(p.id, p.full_name);
  }
  return NextResponse.json(rows.map(r => ({
    ...r,
    profiles: { full_name: nameById.get(r.requested_by) ?? "Unknown" },
  })));
}

// Admin approves or denies a request
export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin" && profile?.role !== "owner") {
    return NextResponse.json({ error: "Only admins can respond to requests" }, { status: 403 });
  }

  const { id, status, task_id, days_requested } = await req.json();
  const admin = adminClient();

  const { error } = await admin.from("extension_requests").update({ status }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // If approved, extend the task due date
  if (status === "approved" && task_id && days_requested) {
    const { data: task } = await admin.from("tasks").select("due_date").eq("id", task_id).maybeSingle();
    const base = task?.due_date ? new Date(task.due_date) : new Date();
    base.setDate(base.getDate() + days_requested);
    await admin.from("tasks").update({ due_date: base.toISOString().split("T")[0] }).eq("id", task_id);
  }

  return NextResponse.json({ ok: true });
}
