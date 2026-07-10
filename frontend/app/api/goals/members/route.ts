import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

async function getCtx() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles")
    .select("organization_id, role, full_name").eq("id", user.id).maybeSingle();
  return {
    userId: user.id,
    orgId: profile?.organization_id ?? "",
    isAdmin: profile?.role === "admin" || profile?.role === "owner",
    name: profile?.full_name ?? "Someone",
  };
}

/** POST { goal_id, user_ids: [] } — invite members to a goal. */
export async function POST(req: NextRequest) {
  const ctx = await getCtx();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { goal_id, user_ids } = await req.json();
  if (!goal_id || !Array.isArray(user_ids) || !user_ids.length) {
    return NextResponse.json({ error: "goal_id and user_ids are required" }, { status: 400 });
  }

  const svc = createServiceClient();
  const { data: goal } = await svc.from("goals")
    .select("id, title, created_by, org_id, visibility").eq("id", goal_id).maybeSingle();
  if (!goal || goal.org_id !== ctx.orgId) return NextResponse.json({ error: "Goal not found" }, { status: 404 });
  if (goal.created_by !== ctx.userId && !ctx.isAdmin) {
    return NextResponse.json({ error: "Only the goal creator can invite" }, { status: 403 });
  }

  // Only same-org members, never the creator, skip existing participants
  const { data: orgProfiles } = await svc.from("profiles")
    .select("id").eq("organization_id", ctx.orgId).in("id", user_ids);
  const { data: existing } = await svc.from("goal_members")
    .select("user_id").eq("goal_id", goal_id);
  const existingIds = new Set((existing ?? []).map(m => m.user_id));
  const invitees = (orgProfiles ?? []).map(p => p.id)
    .filter(id => id !== goal.created_by && !existingIds.has(id));

  if (invitees.length) {
    const { error } = await svc.from("goal_members").insert(
      invitees.map(uid => ({ goal_id, user_id: uid, added_by: ctx.userId })),
    );
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    // A private goal with participants becomes a team goal
    if (goal.visibility === "private") {
      await svc.from("goals").update({ visibility: "team" }).eq("id", goal_id);
    }

    await svc.from("notifications").insert(invitees.map(uid => ({
      id: `n${Date.now()}${uid.slice(0, 6)}`,
      user_id: uid,
      type: "goal_invite",
      title: `${ctx.name} added you to a goal`,
      body: `You can now update progress on "${goal.title}"`,
    })));
  }

  return NextResponse.json({ ok: true, added: invitees.length });
}

/** DELETE { goal_id, user_id } — remove a participant (creator/admin, or self-leave). */
export async function DELETE(req: NextRequest) {
  const ctx = await getCtx();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { goal_id, user_id } = await req.json();
  if (!goal_id || !user_id) return NextResponse.json({ error: "goal_id and user_id required" }, { status: 400 });

  const svc = createServiceClient();
  const { data: goal } = await svc.from("goals")
    .select("created_by, org_id").eq("id", goal_id).maybeSingle();
  if (!goal || goal.org_id !== ctx.orgId) return NextResponse.json({ error: "Goal not found" }, { status: 404 });

  const isSelf = user_id === ctx.userId;
  if (!isSelf && goal.created_by !== ctx.userId && !ctx.isAdmin) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  await svc.from("goal_members").delete().eq("goal_id", goal_id).eq("user_id", user_id);
  return NextResponse.json({ ok: true });
}
