import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
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

const CACHE_TTL_MS = 15 * 60 * 1000;

interface CacheRow {
  provider: "google" | "outlook";
  event_id: string;
  title: string;
  start_at: string;
  end_at: string;
  all_day: boolean;
  meet_link: string | null;
  external_link: string | null;
  synced_at: string;
}

function rowToEvent(r: CacheRow): UnifiedCalendarEvent {
  return {
    id: `${r.provider}::${r.event_id}`,
    title: r.title,
    start: r.start_at,
    end: r.end_at,
    allDay: r.all_day,
    source: r.provider,
    meetLink: r.meet_link ?? undefined,
    externalLink: r.external_link ?? undefined,
  };
}

async function refreshProviderCache(
  svc: ReturnType<typeof createServiceClient>,
  userId: string,
  days: number,
): Promise<void> {
  const rows: Omit<CacheRow, "synced_at">[] = [];

  const googleToken = await getValidToken(userId, svc);
  if (googleToken) {
    try {
      const raw = await listEvents(googleToken, days);
      for (const ev of raw) {
        rows.push({
          provider: "google",
          event_id: ev.id,
          title: ev.summary ?? "(No title)",
          start_at: ev.start.dateTime ?? ev.start.date ?? "",
          end_at: ev.end.dateTime ?? ev.end.date ?? "",
          all_day: !ev.start.dateTime,
          meet_link: ev.hangoutLink ?? null,
          external_link: ev.htmlLink ?? null,
        });
      }
    } catch {}
  }

  const msToken = await getValidMicrosoftToken(userId, svc);
  if (msToken) {
    try {
      // Graph returns naive "UTC" datetimes without a trailing Z (per the
      // Prefer: outlook.timezone="UTC" header) — append it so clients parse correctly.
      const asUtcIso = (dt: string) => (dt.endsWith("Z") ? dt : `${dt}Z`);
      const raw = await listMicrosoftEvents(msToken, days);
      for (const ev of raw) {
        rows.push({
          provider: "outlook",
          event_id: ev.id,
          title: ev.subject ?? "(No title)",
          start_at: ev.isAllDay ? ev.start.dateTime.split("T")[0] : asUtcIso(ev.start.dateTime),
          end_at: ev.isAllDay ? ev.end.dateTime.split("T")[0] : asUtcIso(ev.end.dateTime),
          all_day: !!ev.isAllDay,
          meet_link: ev.onlineMeeting?.joinUrl ?? null,
          external_link: ev.webLink ?? null,
        });
      }
    } catch {}
  }

  // Replace the user's cache window in one round trip each way
  await svc.from("calendar_events_cache").delete().eq("user_id", userId);
  if (rows.length > 0) {
    await svc.from("calendar_events_cache").insert(
      rows.map(r => ({ ...r, user_id: userId, synced_at: new Date().toISOString() }))
    );
  }
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const days = parseInt(req.nextUrl.searchParams.get("days") ?? "90", 10);
  const forceRefresh = req.nextUrl.searchParams.get("refresh") === "1";
  const svc = createServiceClient();

  // Serve from cache when fresh — providers are only hit every CACHE_TTL_MS
  const { data: cached } = await svc
    .from("calendar_events_cache")
    .select("provider, event_id, title, start_at, end_at, all_day, meet_link, external_link, synced_at")
    .eq("user_id", user.id)
    .order("start_at");

  const newest = (cached ?? []).reduce<string | null>(
    (max, r) => (!max || r.synced_at > max ? r.synced_at : max), null);
  const fresh = newest && Date.now() - new Date(newest).getTime() < CACHE_TTL_MS;

  let rows = (cached ?? []) as CacheRow[];
  if (forceRefresh || !fresh) {
    await refreshProviderCache(svc, user.id, days);
    const { data: refreshed } = await svc
      .from("calendar_events_cache")
      .select("provider, event_id, title, start_at, end_at, all_day, meet_link, external_link, synced_at")
      .eq("user_id", user.id)
      .order("start_at");
    rows = (refreshed ?? []) as CacheRow[];
  }

  const events = rows.map(rowToEvent);
  return NextResponse.json({ events, sources: [...new Set(events.map(e => e.source))] });
}
