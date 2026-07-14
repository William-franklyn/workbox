import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

async function getCtx() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles")
    .select("organization_id, role, full_name").eq("id", user.id).maybeSingle();
  return {
    supabase,
    userId: user.id,
    orgId: profile?.organization_id ?? "",
    isAdmin: profile?.role === "admin" || profile?.role === "owner",
    name: profile?.full_name ?? "Someone",
  };
}

/** Creator, invited participant, or workspace admin/owner. */
async function canUpdateGoal(
  goalId: string, userId: string, isAdmin: boolean,
): Promise<boolean> {
  if (isAdmin) return true;
  const svc = createServiceClient();
  const { data: goal } = await svc.from("goals").select("created_by").eq("id", goalId).maybeSingle();
  if (goal?.created_by === userId) return true;
  const { data: member } = await svc.from("goal_members")
    .select("user_id").eq("goal_id", goalId).eq("user_id", userId).maybeSingle();
  return !!member;
}

export async function GET() {
  const ctx = await getCtx();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const svc = createServiceClient();
  const [{ data: allGoals }, { data: krs }, { data: memberRows }, { data: contribRows }] = await Promise.all([
    svc.from("goals").select("*").eq("org_id", ctx.orgId).order("created_at"),
    svc.from("key_results").select("*").order("created_at"),
    svc.from("goal_members").select("goal_id, user_id"),
    // Best-effort: null if the goal_contributions table isn't migrated yet.
    svc.from("goal_contributions").select("goal_id, key_result_id, user_id, delta, new_value, created_at").order("created_at", { ascending: false }),
  ]);

  // Private goals are creator-only
  const goals = (allGoals ?? []).filter(g => g.visibility !== "private" || g.created_by === ctx.userId);
  const goalIds = new Set(goals.map(g => g.id));

  // Resolve names for participants AND contributors in one query
  const memberIds = [...new Set([
    ...(memberRows ?? []).map(m => m.user_id),
    ...(contribRows ?? []).map(c => c.user_id).filter(Boolean),
  ])];
  const { data: profiles } = memberIds.length
    ? await svc.from("profiles").select("id, full_name").in("id", memberIds)
    : { data: [] };
  const nameById = Object.fromEntries((profiles ?? []).map(p => [p.id, p.full_name]));

  const members = (memberRows ?? [])
    .filter(m => goalIds.has(m.goal_id))
    .map(m => ({ goal_id: m.goal_id, user_id: m.user_id, full_name: nameById[m.user_id] ?? "Member" }));

  const contributions = (contribRows ?? [])
    .filter(c => goalIds.has(c.goal_id))
    .map(c => ({ ...c, full_name: nameById[c.user_id] ?? "Member" }));

  return NextResponse.json({
    goals,
    keyResults: (krs ?? []).filter(k => goalIds.has(k.goal_id)),
    members,
    contributions,
    me: { id: ctx.userId, isAdmin: ctx.isAdmin },
  });
}

export async function POST(req: NextRequest) {
  const ctx = await getCtx();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { type, member_ids, ...row } = body;

  for (const k of Object.keys(row)) {
    if (row[k] === "") row[k] = null;
  }

  if (type === "goal") {
    const { data, error } = await createServiceClient().from("goals")
      .insert({ ...row, org_id: ctx.orgId, created_by: ctx.userId }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    // Invite participants (team goals)
    const invitees: string[] = (member_ids ?? []).filter((id: string) => id !== ctx.userId);
    if (invitees.length && data.visibility !== "private") {
      const svc = createServiceClient();
      await svc.from("goal_members").insert(
        invitees.map(uid => ({ goal_id: data.id, user_id: uid, added_by: ctx.userId })),
      );
      await svc.from("notifications").insert(invitees.map(uid => ({
        id: `n${Date.now()}${uid.slice(0, 6)}`,
        user_id: uid,
        type: "goal_invite",
        title: `${ctx.name} added you to a goal`,
        body: `You can now update progress on "${data.title}"`,
      })));
    }
    return NextResponse.json(data);
  }

  if (type === "kr") {
    if (row.goal_id && !(await canUpdateGoal(row.goal_id, ctx.userId, ctx.isAdmin))) {
      return NextResponse.json({ error: "Only participants can add key results" }, { status: 403 });
    }
    const { data, error } = await createServiceClient().from("key_results").insert(row).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data);
  }
  return NextResponse.json({ error: "Invalid type" }, { status: 400 });
}

export async function PATCH(req: NextRequest) {
  const ctx = await getCtx();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, type, ...patch } = await req.json();
  const table = type === "goal" ? "goals" : "key_results";

  // Progress updates are limited to participants (creator/invited/admin)
  const svc = createServiceClient();
  const goalId = type === "goal"
    ? id
    : (await svc.from("key_results").select("goal_id").eq("id", id).maybeSingle()).data?.goal_id;
  if (goalId && !(await canUpdateGoal(goalId, ctx.userId, ctx.isAdmin))) {
    return NextResponse.json({ error: "Only participants can update this goal" }, { status: 403 });
  }

  // Snapshot the previous key-result value so we can log who moved it.
  let previous: number | null = null;
  if (type === "kr" && patch.current_value !== undefined) {
    const { data: before } = await svc.from("key_results").select("current_value").eq("id", id).maybeSingle();
    previous = Number(before?.current_value ?? 0);
  }

  const { data, error } = await svc.from(table).update(patch).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Record the contribution (who changed the value, and by how much).
  // Best-effort: if the table isn't migrated yet, the update still succeeds.
  if (type === "kr" && previous !== null && goalId) {
    const nextVal = Number(patch.current_value);
    const delta = nextVal - previous;
    if (delta !== 0) {
      await svc.from("goal_contributions").insert({
        id: `gc${Date.now()}${Math.random().toString(36).slice(2, 7)}`,
        org_id: ctx.orgId || null,
        goal_id: goalId,
        key_result_id: id,
        user_id: ctx.userId,
        delta,
        new_value: nextVal,
      });
    }
  }

  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const ctx = await getCtx();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, type } = await req.json();
  const table = type === "goal" ? "goals" : "key_results";

  const svc = createServiceClient();
  const goalId = type === "goal"
    ? id
    : (await svc.from("key_results").select("goal_id").eq("id", id).maybeSingle()).data?.goal_id;
  if (goalId) {
    const { data: goal } = await svc.from("goals").select("created_by").eq("id", goalId).maybeSingle();
    if (goal && goal.created_by !== ctx.userId && !ctx.isAdmin) {
      return NextResponse.json({ error: "Only the goal creator can delete" }, { status: 403 });
    }
  }

  await svc.from(table).delete().eq("id", id);
  return NextResponse.json({ ok: true });
}
