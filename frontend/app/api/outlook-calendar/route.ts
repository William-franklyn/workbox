import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getValidToken, listEvents, createCalendarEvent, MSCalEvent } from "@/lib/microsoft/calendar";

function normalizeEvent(ev: MSCalEvent) {
  const toUTC = (dt: string) => (dt.endsWith("Z") ? dt : dt + "Z");
  return {
    id: `outlook:${ev.id}`,
    summary: ev.subject,
    description: ev.body?.content,
    start: ev.isAllDay
      ? { date: ev.start.dateTime.split("T")[0] }
      : { dateTime: toUTC(ev.start.dateTime) },
    end: ev.isAllDay
      ? { date: ev.end.dateTime.split("T")[0] }
      : { dateTime: toUTC(ev.end.dateTime) },
    attendees: (ev.attendees ?? []).map((a) => ({
      email: a.emailAddress.address,
      displayName: a.emailAddress.name,
      responseStatus: a.status?.response ?? "none",
    })),
    hangoutLink: ev.onlineMeeting?.joinUrl ?? undefined,
    htmlLink: ev.webLink,
    status: "confirmed",
    source: "outlook",
  };
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const token = await getValidToken(user.id, supabase);
  if (!token) return NextResponse.json({ error: "not_connected" }, { status: 401 });

  const days = parseInt(req.nextUrl.searchParams.get("days") ?? "30", 10);
  const events = await listEvents(token, days);
  return NextResponse.json(events.map(normalizeEvent));
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const token = await getValidToken(user.id, supabase);
  if (!token) return NextResponse.json({ error: "not_connected" }, { status: 401 });

  const { title, description, startDateTime, endDateTime, attendeeEmails, addTeamsLink } = await req.json();
  if (!title || !startDateTime || !endDateTime) {
    return NextResponse.json({ error: "title, startDateTime, and endDateTime are required" }, { status: 400 });
  }

  const event = await createCalendarEvent(token, {
    title, description, startDateTime, endDateTime, attendeeEmails, addTeamsLink,
  });
  if (!event) return NextResponse.json({ error: "Failed to create calendar event" }, { status: 500 });

  return NextResponse.json({ event: normalizeEvent(event) }, { status: 201 });
}
