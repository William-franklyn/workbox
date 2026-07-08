import { NextRequest, NextResponse } from "next/server";
import { requireOrg, assertSpaceInOrg } from "@/lib/auth/guard";

/**
 * GET /api/v1/spaces/:id/members
 * Returns everyone who has been assigned a task in this space,
 * plus the workspace owner. Derives membership from task assignees
 * since WorkBox doesn't store per-space membership separately.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireOrg(req);
  if ("error" in auth) return auth.error;
  const { ctx } = auth;
  const userId = ctx.userId;

  const { id: spaceId } = await params;
  const spaceErr = await assertSpaceInOrg(ctx, spaceId);
  if (spaceErr) return spaceErr;

  const supabase = ctx.svc;

  // Get all lists in this space
  const { data: lists } = await supabase
    .from("lists").select("id").eq("space_id", spaceId);
  const listIds = (lists ?? []).map((l: { id: string }) => l.id);

  // Collect unique user IDs from task assignees + creators in this space
  const memberIds = new Set<string>();
  if (listIds.length) {
    const { data: tasks } = await supabase
      .from("tasks")
      .select("assignee_id, created_by")
      .in("list_id", listIds);
    for (const t of tasks ?? []) {
      if (t.assignee_id) memberIds.add(t.assignee_id);
      if (t.created_by) memberIds.add(t.created_by);
    }
  }
  // Always include the requesting user
  memberIds.add(userId);

  if (!memberIds.size) return NextResponse.json({ members: [] });

  // Look up profiles for known IDs
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, email, role")
    .in("id", [...memberIds]);

  const profileMap = new Map((profiles ?? []).map((p: { id: string; full_name: string; email: string; role: string }) => [p.id, p]));

  // Fill in any IDs not in profiles via auth admin
  const missing = [...memberIds].filter(id => !profileMap.has(id));
  for (const mid of missing) {
    const { data: { user } } = await supabase.auth.admin.getUserById(mid);
    if (user) {
      profileMap.set(mid, {
        id: user.id,
        full_name: user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "Unknown",
        email: user.email ?? "",
        role: user.user_metadata?.role ?? "member",
      });
    }
  }

  const members = [...profileMap.values()].map(m => ({
    ...m,
    is_you: m.id === userId,
  }));

  return NextResponse.json({ space_id: spaceId, members });
}
