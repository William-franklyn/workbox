import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .maybeSingle();

  const orgId = profile?.organization_id ?? null;
  const svc = createServiceClient();

  // Fetch all tasks that have an assignee
  const { data: tasks } = await svc
    .from("tasks")
    .select("id, title, status, priority, due_date, list_id, assignee_id")
    .not("assignee_id", "is", null);

  // Count tasks without assignee
  const { count: unassignedCount } = await svc
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .is("assignee_id", null);

  if (!tasks || tasks.length === 0) {
    return NextResponse.json({ members: [], unassigned_count: unassignedCount ?? 0 });
  }

  // Get unique assignee IDs
  const assigneeIds = [...new Set(tasks.map((t) => t.assignee_id as string))];

  // Fetch profile data for all assignees — no org filter if orgId is null
  let profilesQuery = svc
    .from("profiles")
    .select("id, full_name, email")
    .in("id", assigneeIds);

  if (orgId) {
    profilesQuery = profilesQuery.eq("organization_id", orgId);
  }

  const { data: profiles } = await profilesQuery;

  const profileMap = new Map<string, { id: string; full_name: string; email: string }>(
    (profiles ?? []).map((p) => [p.id, p])
  );

  const today = new Date().toISOString().slice(0, 10);

  type MemberEntry = {
    id: string;
    name: string;
    email: string;
    tasks: {
      total: number;
      todo: number;
      in_progress: number;
      in_review: number;
      done: number;
      overdue: number;
      urgent: number;
    };
    task_list: {
      id: string;
      title: string;
      status: string;
      priority: string;
      due_date: string | null;
      list_id: string;
    }[];
  };

  const memberMap = new Map<string, MemberEntry>();

  for (const task of tasks) {
    const aid = task.assignee_id as string;
    const prof = profileMap.get(aid);

    if (!memberMap.has(aid)) {
      memberMap.set(aid, {
        id: aid,
        name: prof?.full_name ?? "Unknown",
        email: prof?.email ?? "",
        tasks: { total: 0, todo: 0, in_progress: 0, in_review: 0, done: 0, overdue: 0, urgent: 0 },
        task_list: [],
      });
    }

    const member = memberMap.get(aid)!;
    member.tasks.total++;

    const status = task.status as string;
    if (status === "todo") member.tasks.todo++;
    else if (status === "in_progress") member.tasks.in_progress++;
    else if (status === "in_review") member.tasks.in_review++;
    else if (status === "done") member.tasks.done++;

    if (task.due_date && task.due_date < today && status !== "done") {
      member.tasks.overdue++;
    }
    if (task.priority === "urgent" && status !== "done") {
      member.tasks.urgent++;
    }

    member.task_list.push({
      id: task.id,
      title: task.title,
      status: task.status,
      priority: task.priority,
      due_date: task.due_date ?? null,
      list_id: task.list_id,
    });
  }

  const members = Array.from(memberMap.values()).sort((a, b) => b.tasks.total - a.tasks.total);

  return NextResponse.json({ members, unassigned_count: unassignedCount ?? 0 });
}
