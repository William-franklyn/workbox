import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-key";
import { createServiceClient } from "@/lib/supabase/server";
import { getValidToken, listEvents, createCalendarEvent } from "@/lib/google/calendar";

export async function GET(req: NextRequest) {
  const userId = await validateApiKey(req.headers.get("authorization"));
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const days = parseInt(req.nextUrl.searchParams.get("days") ?? "14", 10);
  const supabase = createServiceClient();
  const token = await getValidToken(userId, supabase);
  if (!token) return NextResponse.json({ error: "Google Calendar not connected" }, { status: 424 });

  const events = await listEvents(token, days);
  return NextResponse.json({
    meetings: events.map(e => ({
      id: e.id,
      title: e.summary,
      start: e.start.dateTime ?? e.start.date,
      end:   e.end.dateTime   ?? e.end.date,
      meet_link: e.hangoutLink ?? null,
      html_link: e.htmlLink,
      attendees: (e.attendees ?? []).map(a => a.email),
    })),
  });
}

export async function POST(req: NextRequest) {
  const userId = await validateApiKey(req.headers.get("authorization"));
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { title, start, end, attendees, add_meet_link = true, description } = body;
  if (!title || !start || !end) {
    return NextResponse.json({ error: "title, start, and end are required" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const token = await getValidToken(userId, supabase);
  if (!token) return NextResponse.json({ error: "Google Calendar not connected" }, { status: 424 });

  const event = await createCalendarEvent(token, {
    title,
    description,
    startDateTime: start,
    endDateTime: end,
    attendeeEmails: attendees ?? [],
    addMeetLink: add_meet_link,
  });

  if (!event) return NextResponse.json({ error: "Failed to create event" }, { status: 500 });

  return NextResponse.json({
    meeting: {
      id: event.id,
      title: event.summary,
      start: event.start.dateTime ?? event.start.date,
      end:   event.end.dateTime   ?? event.end.date,
      meet_link: event.hangoutLink ?? null,
      html_link: event.htmlLink,
    },
  }, { status: 201 });
}
