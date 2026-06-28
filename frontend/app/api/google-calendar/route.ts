import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getValidToken, listEvents, createCalendarEvent } from "@/lib/google/calendar";

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const token = await getValidToken(user.id, supabase);
  if (!token) return NextResponse.json({ error: "not_connected" }, { status: 401 });

  const days = parseInt(req.nextUrl.searchParams.get("days") ?? "30", 10);
  const events = await listEvents(token, days);
  return NextResponse.json(events);
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const token = await getValidToken(user.id, supabase);
  if (!token) return NextResponse.json({ error: "not_connected" }, { status: 401 });

  const { title, description, startDateTime, endDateTime, attendeeEmails, addMeetLink, listId } = await req.json();

  const gcalEvent = await createCalendarEvent(token, {
    title, description, startDateTime, endDateTime, attendeeEmails, addMeetLink,
  });
  if (!gcalEvent) return NextResponse.json({ error: "Failed to create calendar event" }, { status: 500 });

  // Resolve which list to use — provided listId, or fall back to first list in org
  let resolvedListId = listId ?? null;
  if (!resolvedListId) {
    const { data: profile } = await supabase.from("profiles").select("organization_id").eq("id", user.id).maybeSingle();
    if (profile?.organization_id) {
      const { data: firstList } = await supabase.from("lists").select("id").limit(1).single();
      resolvedListId = firstList?.id ?? null;
    }
  }

  let task = null;
  if (resolvedListId) {
    const timeLabel = `${fmtTime(startDateTime)} – ${fmtTime(endDateTime)}`;
    const meetLine = gcalEvent.hangoutLink ? `Meet link: ${gcalEvent.hangoutLink}` : "";
    const parts = [`Time: ${timeLabel}`, description ?? "", meetLine, `Calendar: ${gcalEvent.htmlLink}`].filter(Boolean);

    const { count: existingCount } = await supabase
      .from("tasks").select("*", { count: "exact", head: true }).eq("list_id", resolvedListId);

    const { data } = await supabase.from("tasks").insert({
      title: `📅 ${title} (${timeLabel})`,
      description: parts.join("\n"),
      status: "todo",
      priority: "normal",
      list_id: resolvedListId,
      due_date: startDateTime.split("T")[0],
      position: (existingCount ?? 0) * 1000,
      created_by: user.id,
    }).select().single();
    task = data;

    if (task) {
      await supabase.from("calendar_sync").upsert(
        { user_id: user.id, google_event_id: gcalEvent.id, task_id: task.id },
        { onConflict: "user_id,google_event_id" }
      );
    }
  }

  return NextResponse.json({ event: gcalEvent, task });
}
