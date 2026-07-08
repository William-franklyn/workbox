import { NextRequest, NextResponse } from "next/server";
import { requireOrg, assertListInOrg } from "@/lib/auth/guard";

interface BatchEvent {
  eventId: string;
  title: string;
  description?: string;
  startDateTime?: string | null;
  endDateTime?: string | null;
  dueDate?: string | null;
  meetLink?: string | null;
  calendarLink?: string;
}

function stripHtml(raw: string): string {
  return (raw ?? "")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

/**
 * POST { listId, events: BatchEvent[] }
 * Syncs a whole calendar's worth of events into tasks in ONE request:
 * one dedup query, one bulk task insert, one bulk sync-map upsert —
 * replaces the previous one-POST-per-event pattern.
 */
export async function POST(req: NextRequest) {
  const auth = await requireOrg(req);
  if ("error" in auth) return auth.error;
  const { ctx } = auth;
  if (ctx.role === "guest") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { listId, events } = await req.json() as { listId: string; events: BatchEvent[] };
  if (!listId) return NextResponse.json({ error: "listId required" }, { status: 400 });
  if (!Array.isArray(events) || events.length === 0) {
    return NextResponse.json({ created: 0, skipped: 0 });
  }
  if (events.length > 500) {
    return NextResponse.json({ error: "Max 500 events per batch" }, { status: 400 });
  }

  const listErr = await assertListInOrg(ctx, listId);
  if (listErr) return listErr;

  // One query to find which events are already synced
  const eventIds = events.map(e => e.eventId);
  const { data: existing } = await ctx.svc
    .from("calendar_sync")
    .select("google_event_id")
    .eq("user_id", ctx.userId)
    .in("google_event_id", eventIds);
  const alreadySynced = new Set((existing ?? []).map(r => r.google_event_id));

  const toCreate = events.filter(e => !alreadySynced.has(e.eventId));
  if (toCreate.length === 0) {
    return NextResponse.json({ created: 0, skipped: events.length });
  }

  const { count: existingCount } = await ctx.svc
    .from("tasks")
    .select("*", { count: "exact", head: true })
    .eq("list_id", listId);

  const basePosition = (existingCount ?? 0) * 1000;
  const now = Date.now();

  const taskRows = toCreate.map((ev, i) => {
    const timeLabel = ev.startDateTime
      ? ev.endDateTime
        ? `${fmtTime(ev.startDateTime)} – ${fmtTime(ev.endDateTime)}`
        : fmtTime(ev.startDateTime)
      : "";
    const parts = [
      timeLabel ? `Time: ${timeLabel}` : "",
      stripHtml(ev.description ?? ""),
      ev.meetLink ? `Meet link: ${ev.meetLink}` : "",
      ev.calendarLink ? `Calendar: ${ev.calendarLink}` : "",
    ].filter(Boolean);

    return {
      id: `tsk${now}${i}${Math.floor(Math.random() * 1000)}`,
      title: `📅 ${ev.title}${timeLabel ? ` (${timeLabel})` : ""}`,
      description: parts.join("\n"),
      status: "todo",
      priority: "normal",
      list_id: listId,
      due_date: ev.dueDate ?? null,
      position: basePosition + i * 1000,
      created_by: ctx.userId,
    };
  });

  const { data: created, error } = await ctx.svc.from("tasks").insert(taskRows).select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const syncRows = toCreate.map((ev, i) => ({
    user_id: ctx.userId,
    google_event_id: ev.eventId,
    task_id: taskRows[i].id,
  }));
  await ctx.svc.from("calendar_sync").upsert(syncRows, { onConflict: "user_id,google_event_id" });

  return NextResponse.json({ created: created?.length ?? 0, skipped: alreadySynced.size });
}
