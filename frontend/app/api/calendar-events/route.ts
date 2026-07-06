import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getValidToken, listEvents } from "@/lib/google/calendar";
import { getValidToken as getValidMicrosoftToken, listEvents as listMicrosoftEvents } from "@/lib/microsoft/calendar";

export interface UnifiedCalendarEvent {
  id: string;
  title: string;
  start: string;       // ISO datetime or YYYY-MM-DD for all-day
  end: string;
  allDay: boolean;
  source: "google" | "microsoft" | "zoom" | "apple" | "outlook";
  meetLink?: string;
  externalLink?: string;
}

const SOURCE_META: Record<UnifiedCalendarEvent["source"], { label: string; color: string }> = {
  google:    { label: "Google Calendar",     color: "#4285F4" },
  microsoft: { label: "Microsoft Calendar",  color: "#0078D4" },
  outlook:   { label: "Outlook Calendar",    color: "#0078D4" },
  apple:     { label: "Apple Calendar",      color: "#FF3B30" },
  zoom:      { label: "Zoom",                color: "#2D8CFF" },
};

export { SOURCE_META };

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const days = parseInt(req.nextUrl.searchParams.get("days") ?? "90", 10);
  const events: UnifiedCalendarEvent[] = [];

  // ── Google Calendar ────────────────────────────────────────────────────────
  const googleToken = await getValidToken(user.id, supabase);
  if (googleToken) {
    try {
      const raw = await listEvents(googleToken, days);
      for (const ev of raw) {
        const allDay = !ev.start.dateTime;
        events.push({
          id: `google::${ev.id}`,
          title: ev.summary ?? "(No title)",
          start: ev.start.dateTime ?? ev.start.date ?? "",
          end:   ev.end.dateTime   ?? ev.end.date   ?? "",
          allDay,
          source: "google",
          meetLink: ev.hangoutLink ?? undefined,
          externalLink: ev.htmlLink,
        });
      }
    } catch {}
  }

  // ── Microsoft / Outlook ─────────────────────────────────────────────────────
  // Graph returns naive "UTC" datetime strings with no trailing Z (per the
  // Prefer: outlook.timezone="UTC" header in listEvents), so append it here.
  const asUtcIso = (dt: string) => (dt.endsWith("Z") ? dt : `${dt}Z`);
  const microsoftToken = await getValidMicrosoftToken(user.id, supabase);
  if (microsoftToken) {
    try {
      const raw = await listMicrosoftEvents(microsoftToken, days);
      for (const ev of raw) {
        events.push({
          id: `outlook::${ev.id}`,
          title: ev.subject ?? "(No title)",
          start: asUtcIso(ev.start.dateTime),
          end: asUtcIso(ev.end.dateTime),
          allDay: !!ev.isAllDay,
          source: "outlook",
          meetLink: ev.onlineMeeting?.joinUrl ?? undefined,
          externalLink: ev.webLink,
        });
      }
    } catch {}
  }

  // ── Apple Calendar (future) ────────────────────────────────────────────────
  // When Apple Calendar integration is added, fetch and push here with source: "apple"

  // ── Zoom (future) ──────────────────────────────────────────────────────────
  // When Zoom integration is added, fetch and push here with source: "zoom"

  return NextResponse.json({ events, sources: [...new Set(events.map(e => e.source))] });
}
