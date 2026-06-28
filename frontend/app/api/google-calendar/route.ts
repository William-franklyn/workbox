import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getValidToken, listEvents, createCalendarEvent } from "@/lib/google/calendar";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const token = await getValidToken(user.id, supabase);
  if (!token) return NextResponse.json({ error: "not_connected" }, { status: 401 });

  const events = await listEvents(token, 30);
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

  let task = null;
  if (listId) {
    const meetLine = gcalEvent.hangoutLink ? `\nMeet link: ${gcalEvent.hangoutLink}` : "";
    const { data } = await supabase.from("tasks").insert({
      title: `📅 ${title}`,
      description: `${description ?? ""}${meetLine}\nCalendar: ${gcalEvent.htmlLink}`.trim(),
      status: "todo",
      priority: "normal",
      list_id: listId,
      due_date: startDateTime.split("T")[0],
      position: 0,
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
