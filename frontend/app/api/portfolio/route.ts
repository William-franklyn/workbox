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

  const today = new Date().toISOString().slice(0, 10);

  // Fetch spaces
  let spacesQuery = svc.from("spaces").select("id, name, icon, color").order("position");
  if (orgId) spacesQuery = spacesQuery.eq("org_id", orgId);
  const { data: spaces } = await spacesQuery;

  // Fetch all lists
  const { data: lists } = await svc.from("lists").select("id, name, space_id, color").order("position");

  // Fetch all tasks with relevant fields
  const { data: tasks } = await svc
    .from("tasks")
    .select("id, status, due_date, list_id")
    .order("created_at");

  // Fetch goals
  let goalsQuery = svc.from("goals").select("id, title, due_date").order("created_at");
  if (orgId) goalsQuery = goalsQuery.eq("org_id", orgId);
  const { data: goals } = await goalsQuery;

  // Fetch key results
  const { data: keyResults } = await svc
    .from("key_results")
    .select("id, goal_id, title, current_value, target_value, unit")
    .order("created_at");

  const spaceList = spaces ?? [];
  const listList = lists ?? [];
  const taskList = tasks ?? [];
  const goalList = goals ?? [];
  const krList = keyResults ?? [];

  // Build list -> tasks map
  type TaskCounts = {
    total: number;
    todo: number;
    in_progress: number;
    in_review: number;
    done: number;
    overdue: number;
  };

  const listTaskMap = new Map<string, TaskCounts>();
  for (const task of taskList) {
    if (!listTaskMap.has(task.list_id)) {
      listTaskMap.set(task.list_id, { total: 0, todo: 0, in_progress: 0, in_review: 0, done: 0, overdue: 0 });
    }
    const counts = listTaskMap.get(task.list_id)!;
    counts.total++;
    if (task.status === "todo") counts.todo++;
    else if (task.status === "in_progress") counts.in_progress++;
    else if (task.status === "in_review") counts.in_review++;
    else if (task.status === "done") counts.done++;
    if (task.due_date && task.due_date < today && task.status !== "done") counts.overdue++;
  }

  function sumCounts(items: TaskCounts[]): TaskCounts {
    return items.reduce(
      (acc, c) => ({
        total: acc.total + c.total,
        todo: acc.todo + c.todo,
        in_progress: acc.in_progress + c.in_progress,
        in_review: acc.in_review + c.in_review,
        done: acc.done + c.done,
        overdue: acc.overdue + c.overdue,
      }),
      { total: 0, todo: 0, in_progress: 0, in_review: 0, done: 0, overdue: 0 }
    );
  }

  // Build space entries
  const spaceEntries = spaceList.map((space) => {
    const spaceLists = listList.filter((l) => l.space_id === space.id);
    const listEntries = spaceLists.map((l) => ({
      id: l.id,
      name: l.name,
      task_counts: listTaskMap.get(l.id) ?? { total: 0, todo: 0, in_progress: 0, in_review: 0, done: 0, overdue: 0 },
    }));
    const aggregated = sumCounts(listEntries.map((le) => le.task_counts));
    const completionRate =
      aggregated.total > 0 ? Math.round((aggregated.done / aggregated.total) * 100) : 0;

    return {
      id: space.id,
      name: space.name,
      icon: space.icon ?? "",
      color: space.color ?? "#7c3aed",
      task_counts: aggregated,
      completion_rate: completionRate,
      lists: listEntries,
    };
  });

  // Build goal entries with computed progress
  const goalEntries = goalList.map((goal) => {
    const krs = krList.filter((kr) => kr.goal_id === goal.id);
    const progress =
      krs.length > 0
        ? Math.round(
            krs.reduce(
              (sum, kr) => sum + Math.min((kr.current_value / (kr.target_value || 1)) * 100, 100),
              0
            ) / krs.length
          )
        : 0;

    return {
      id: goal.id,
      title: goal.title,
      due_date: goal.due_date ?? null,
      progress,
      key_results: krs.map((kr) => ({
        id: kr.id,
        title: kr.title,
        current_value: kr.current_value,
        target_value: kr.target_value,
        unit: kr.unit ?? "%",
        progress: Math.min(Math.round((kr.current_value / (kr.target_value || 1)) * 100), 100),
      })),
    };
  });

  // Totals across all spaces
  const allCounts = sumCounts(spaceEntries.map((s) => s.task_counts));
  const overallCompletion =
    allCounts.total > 0 ? Math.round((allCounts.done / allCounts.total) * 100) : 0;

  return NextResponse.json({
    spaces: spaceEntries,
    goals: goalEntries,
    totals: {
      spaces: spaceList.length,
      total_tasks: allCounts.total,
      done_tasks: allCounts.done,
      overdue_tasks: allCounts.overdue,
      completion_rate: overallCompletion,
    },
  });
}
