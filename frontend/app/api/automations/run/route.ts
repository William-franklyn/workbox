import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireOrg } from "@/lib/auth/guard";

// Called internally when a task event occurs, or manually to check due-date automations.
// POST { event: "status_change"|"task_created"|"priority_change"|"assignee_change"|"due_date_passed", task_id, old_value?, new_value?, org_id }

/**
 * Resolves which org this run is allowed to operate on.
 * - Internal callers (Vercel cron) authenticate with CRON_SECRET and may pass any org_id.
 * - Everyone else must have a session/API key; their own org is used regardless
 *   of what org_id they pass.
 */
async function resolveRunOrg(req: NextRequest, requestedOrgId: string | null): Promise<string | NextResponse> {
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (secret && authHeader === `Bearer ${secret}`) {
    return requestedOrgId ?? "";
  }
  const auth = await requireOrg(req);
  if ("error" in auth) return auth.error;
  return auth.ctx.orgId;
}

export async function POST(req: NextRequest) {
  const svc = createServiceClient();
  const body = await req.json();
  const { event, task_id, old_value, new_value } = body;

  if (!event) return NextResponse.json({ error: "event required" }, { status: 400 });

  const orgOrError = await resolveRunOrg(req, body.org_id ?? null);
  if (orgOrError instanceof NextResponse) return orgOrError;
  const org_id = orgOrError;

  // Ensure the task actually belongs to this org before mutating it
  if (task_id && org_id) {
    const { data: task } = await svc.from("tasks").select("id, org_id").eq("id", task_id).maybeSingle();
    if (!task || (task.org_id && task.org_id !== org_id)) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }
  }

  // Fetch enabled automations for this org matching the trigger
  let q = svc.from("automations").select("*").eq("trigger_type", event).eq("enabled", true);
  if (org_id) q = (q as any).eq("org_id", org_id);
  const { data: automations } = await q;
  if (!automations?.length) return NextResponse.json({ ran: 0 });

  let ran = 0;

  for (const auto of automations) {
    // Check trigger value match if specified
    if (auto.trigger_value && new_value && auto.trigger_value !== new_value) continue;

    // Execute action
    try {
      if (auto.action_type === "set_status" && task_id) {
        await svc.from("tasks").update({ status: auto.action_value }).eq("id", task_id);
      } else if (auto.action_type === "set_priority" && task_id) {
        await svc.from("tasks").update({ priority: auto.action_value }).eq("id", task_id);
      } else if (auto.action_type === "send_notification") {
        // Get task info for notification
        const { data: task } = await svc.from("tasks").select("title, assignee_id, created_by").eq("id", task_id ?? "").maybeSingle();
        const targetUserId = task?.assignee_id ?? task?.created_by;
        if (targetUserId) {
          await svc.from("notifications").insert({
            id: `notif${Date.now()}`,
            user_id: targetUserId,
            type: "info",
            title: "Automation triggered",
            body: auto.action_value || `Automation "${auto.name}" ran on task "${task?.title}"`,
            task_id: task_id ?? null,
          });
        }
      } else if (auto.action_type === "assign_to" && task_id) {
        // action_value is a user email or id
        const { data: profile } = await svc.from("profiles").select("id").eq("email", auto.action_value).maybeSingle();
        if (profile) await svc.from("tasks").update({ assignee_id: profile.id }).eq("id", task_id);
      } else if (auto.action_type === "move_to_list" && task_id) {
        const { data: list } = await svc.from("lists").select("id").eq("name", auto.action_value).maybeSingle();
        if (list) await svc.from("tasks").update({ list_id: list.id }).eq("id", task_id);
      } else if (auto.action_type === "send_message" && org_id) {
        await svc.from("team_messages").insert({
          id: `msg_auto_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          org_id,
          sender_id: null,
          sender_name: "WorkBox Automations",
          content: auto.action_value || `Automation "${auto.name}" triggered`,
          channel: "general",
          created_at: new Date().toISOString(),
        });
      } else if (auto.action_type === "create_task") {
        // action_value is the task title; find first list in org
        let listId: string | null = null;
        if (org_id) {
          const { data: spaceRows } = await svc.from("spaces").select("id").eq("org_id", org_id).limit(1);
          if (spaceRows?.length) {
            const { data: listRow } = await svc.from("lists").select("id").eq("space_id", spaceRows[0].id).limit(1).maybeSingle();
            listId = listRow?.id ?? null;
          }
        }
        if (listId) {
          await svc.from("tasks").insert({
            id: `task_auto_${Date.now()}_${Math.random().toString(36).slice(2)}`,
            title: auto.action_value || `Auto-created by "${auto.name}"`,
            list_id: listId,
            status: "todo",
            priority: "normal",
            created_at: new Date().toISOString(),
          });
        }
      }

      // Increment run_count
      await svc.from("automations").update({ run_count: (auto.run_count ?? 0) + 1 }).eq("id", auto.id);
      ran++;
    } catch {
      // Continue on error — don't let one failed action block others
    }
  }

  return NextResponse.json({ ran });
}

// GET — check due_date_passed automations (called on page load or scheduled)
export async function GET(req: NextRequest) {
  const svc = createServiceClient();
  const { searchParams } = new URL(req.url);

  const orgOrError = await resolveRunOrg(req, searchParams.get("org_id"));
  if (orgOrError instanceof NextResponse) return orgOrError;
  const orgId = orgOrError || null;

  // Find automations with due_date_passed trigger
  let q = svc.from("automations").select("*").eq("trigger_type", "due_date_passed").eq("enabled", true);
  if (orgId) q = (q as any).eq("org_id", orgId);
  const { data: automations } = await q;
  if (!automations?.length) return NextResponse.json({ ran: 0 });

  // Find overdue tasks (due_date < today, not done)
  const today = new Date().toISOString().slice(0, 10);
  let taskQ = svc.from("tasks").select("id, title, assignee_id, created_by, priority").lt("due_date", today).neq("status", "done");
  if (orgId) {
    // Filter to org's lists
    const { data: lists } = await svc.from("lists").select("id").in("space_id",
      (await svc.from("spaces").select("id").eq("org_id", orgId)).data?.map((s: any) => s.id) ?? []
    );
    if (lists?.length) taskQ = (taskQ as any).in("list_id", lists.map((l: any) => l.id));
  }
  const { data: overdueTasks } = await taskQ;
  if (!overdueTasks?.length) return NextResponse.json({ ran: 0 });

  let ran = 0;
  for (const auto of automations) {
    for (const task of overdueTasks) {
      try {
        if (auto.action_type === "set_priority") {
          await svc.from("tasks").update({ priority: auto.action_value }).eq("id", task.id);
        } else if (auto.action_type === "send_notification") {
          const targetUserId = task.assignee_id ?? task.created_by;
          if (targetUserId) {
            await svc.from("notifications").insert({
              id: `notif${Date.now()}${Math.random()}`,
              user_id: targetUserId,
              type: "info",
              title: "Task overdue",
              body: `"${task.title}" is past its due date`,
              task_id: task.id,
            });
          }
        }
        ran++;
      } catch { /* continue */ }
    }
    await svc.from("automations").update({ run_count: (auto.run_count ?? 0) + ran }).eq("id", auto.id);
  }

  return NextResponse.json({ ran });
}
