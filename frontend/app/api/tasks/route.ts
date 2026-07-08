import { NextRequest, NextResponse } from "next/server";
import { requireOrg, assertListInOrg } from "@/lib/auth/guard";
import { emitWebhook } from "@/lib/webhooks";
import { nextOccurrence, type Recurrence } from "@/lib/recurrence";

export async function GET(req: NextRequest) {
  const auth = await requireOrg(req);
  if ("error" in auth) return auth.error;
  const { ctx } = auth;

  const listId = req.nextUrl.searchParams.get("listId");
  if (!listId) return NextResponse.json({ error: "listId required" }, { status: 400 });

  const listErr = await assertListInOrg(ctx, listId);
  if (listErr) return listErr;

  // Optional pagination: ?limit=200&offset=0 (default returns all for
  // backwards compatibility with existing views)
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") ?? "1000", 10), 1000);
  const offset = parseInt(req.nextUrl.searchParams.get("offset") ?? "0", 10);

  const { data, error } = await ctx.svc
    .from("tasks").select("*")
    .eq("list_id", listId)
    .order("position")
    .range(offset, offset + limit - 1);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const auth = await requireOrg(req);
  if ("error" in auth) return auth.error;
  const { ctx } = auth;
  if (ctx.role === "guest") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  if (body.list_id) {
    const listErr = await assertListInOrg(ctx, body.list_id);
    if (listErr) return listErr;
  }

  const { data, error } = await ctx.svc
    .from("tasks").insert({ ...body, org_id: undefined, created_by: ctx.userId })
    .select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  void emitWebhook(ctx.orgId, "task.created", { task: data });
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest) {
  const auth = await requireOrg(req);
  if ("error" in auth) return auth.error;
  const { ctx } = auth;
  if (ctx.role === "guest") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id, ...patch } = await req.json();
  delete patch.org_id;

  const { data: before } = await ctx.svc
    .from("tasks").select("id, status, due_date, recurrence, recurrence_until, title, description, priority, list_id, assignee_id, tags")
    .eq("id", id).eq("org_id", ctx.orgId).maybeSingle();
  if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data, error } = await ctx.svc
    .from("tasks").update(patch).eq("id", id).eq("org_id", ctx.orgId).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const statusChanged = patch.status && patch.status !== before.status;
  void emitWebhook(ctx.orgId, statusChanged ? "task.status_changed" : "task.updated", {
    task: data,
    ...(statusChanged ? { old_status: before.status, new_status: patch.status } : {}),
  });

  // Recurring tasks: completing an occurrence schedules the next one
  if (statusChanged && patch.status === "done" && before.recurrence && before.due_date) {
    const nextDue = nextOccurrence(before.recurrence as Recurrence, before.due_date);
    const withinLimit = !before.recurrence_until || nextDue <= before.recurrence_until;
    if (withinLimit) {
      await ctx.svc.from("tasks").insert({
        id: `tsk${Date.now()}${Math.floor(Math.random() * 1000)}`,
        title: before.title,
        description: before.description,
        status: "todo",
        priority: before.priority,
        list_id: before.list_id,
        assignee_id: before.assignee_id,
        tags: before.tags,
        due_date: nextDue,
        position: Date.now(),
        created_by: ctx.userId,
        recurrence: before.recurrence,
        recurrence_until: before.recurrence_until,
        recurring_parent_id: before.id,
      });
    }
  }

  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const auth = await requireOrg(req);
  if ("error" in auth) return auth.error;
  const { ctx } = auth;
  if (ctx.role === "guest") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await req.json();
  const { data: task } = await ctx.svc
    .from("tasks").select("id, title, list_id").eq("id", id).eq("org_id", ctx.orgId).maybeSingle();
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { error } = await ctx.svc.from("tasks").delete().eq("id", id).eq("org_id", ctx.orgId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  void emitWebhook(ctx.orgId, "task.deleted", { task });
  return NextResponse.json({ ok: true });
}
