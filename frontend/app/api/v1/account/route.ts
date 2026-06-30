import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-key";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const userId = await validateApiKey(req.headers.get("authorization"));
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createServiceClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, organization_id, created_at")
    .eq("id", userId)
    .maybeSingle();

  const orgId = profile?.organization_id;

  // Spaces
  const { data: spaces } = await supabase
    .from("spaces").select("id, name, icon, color").eq("org_id", orgId ?? "");

  const spaceIds = (spaces ?? []).map(s => s.id);

  // Lists
  const { data: lists } = spaceIds.length
    ? await supabase.from("lists").select("id").in("space_id", spaceIds)
    : { data: [] };

  const listIds = (lists ?? []).map(l => l.id);

  // Tasks stats
  const { data: tasks } = listIds.length
    ? await supabase.from("tasks").select("id, status").in("list_id", listIds)
    : { data: [] };

  const taskStats = {
    total: tasks?.length ?? 0,
    todo: tasks?.filter(t => t.status === "todo").length ?? 0,
    in_progress: tasks?.filter(t => t.status === "in_progress").length ?? 0,
    in_review: tasks?.filter(t => t.status === "in_review").length ?? 0,
    done: tasks?.filter(t => t.status === "done").length ?? 0,
  };

  // Goals
  const { count: goalsCount } = await supabase
    .from("goals").select("id", { count: "exact", head: true }).eq("org_id", orgId ?? "");

  // Docs
  const { count: docsCount } = await supabase
    .from("docs").select("id", { count: "exact", head: true }).eq("org_id", orgId ?? "");

  // Unread notifications
  const { count: unreadCount } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("read", false);

  // Time logged (minutes)
  const { data: timeLogs } = await supabase
    .from("time_logs").select("duration_minutes").eq("user_id", userId);
  const totalMinutes = (timeLogs ?? []).reduce((sum, t) => sum + (t.duration_minutes ?? 0), 0);

  // API keys count
  const { count: apiKeysCount } = await supabase
    .from("api_keys").select("id", { count: "exact", head: true })
    .eq("user_id", userId).eq("active", true);

  return NextResponse.json({
    user: {
      id: profile?.id,
      name: profile?.full_name,
      email: profile?.email,
      role: profile?.role,
      organization_id: orgId,
      member_since: profile?.created_at,
    },
    workspace: {
      spaces: spaces ?? [],
      spaces_count: spaces?.length ?? 0,
      lists_count: listIds.length,
    },
    tasks: taskStats,
    goals_count: goalsCount ?? 0,
    docs_count: docsCount ?? 0,
    unread_notifications: unreadCount ?? 0,
    time_logged_hours: Math.round((totalMinutes / 60) * 10) / 10,
    active_api_keys: apiKeysCount ?? 0,
  });
}
