import { SupabaseClient } from "@supabase/supabase-js";

export interface GCalEvent {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start: { dateTime?: string; date?: string; timeZone?: string };
  end: { dateTime?: string; date?: string; timeZone?: string };
  attendees?: { email: string; displayName?: string; responseStatus?: string }[];
  hangoutLink?: string;
  conferenceData?: { entryPoints?: { entryPointType?: string; uri?: string }[] };
  htmlLink: string;
  status: string;
  created?: string;
}

/**
 * Best-effort joining link for an event. Google Meet lives in hangoutLink,
 * but Zoom/Teams/Webex events keep their link in conferenceData, location,
 * or the description body.
 */
export function getJoinLink(e: GCalEvent): string | null {
  if (e.hangoutLink) return e.hangoutLink;
  const video = e.conferenceData?.entryPoints?.find(p => p.entryPointType === "video" && p.uri);
  if (video?.uri) return video.uri;
  const urlRe = /https?:\/\/[^\s<>"')\]]+/g;
  for (const field of [e.location, e.description]) {
    if (!field) continue;
    const urls = field.match(urlRe) ?? [];
    const conf = urls.find(u => /zoom\.us|meet\.google\.com|teams\.microsoft\.com|webex\.com|whereby\.com/i.test(u));
    if (conf) return conf;
    if (e.location && field === e.location && urls[0]) return urls[0];
  }
  return null;
}

export async function getValidToken(userId: string, supabase: SupabaseClient): Promise<string | null> {
  const { data: integration } = await supabase
    .from("user_integrations")
    .select("*")
    .eq("user_id", userId)
    .eq("provider", "google_calendar")
    .maybeSingle();

  if (!integration?.access_token) return null;

  // Refresh if expiring within 5 minutes
  const expiresAt = integration.token_expires_at ? new Date(integration.token_expires_at) : null;
  const needsRefresh = !expiresAt || expiresAt < new Date(Date.now() + 5 * 60 * 1000);

  if (needsRefresh) {
    if (!integration.refresh_token) return null;

    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        refresh_token: integration.refresh_token,
        grant_type: "refresh_token",
      }),
    });

    const data = await res.json();
    if (!data.access_token) return null;

    await supabase.from("user_integrations").update({
      access_token: data.access_token,
      token_expires_at: new Date(Date.now() + (data.expires_in ?? 3600) * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("user_id", userId).eq("provider", "google_calendar");

    return data.access_token;
  }

  return integration.access_token;
}

export async function listEvents(accessToken: string, days = 30): Promise<GCalEvent[]> {
  // Start from beginning of today (not current time) so today's past events still appear
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const params = new URLSearchParams({
    timeMin: startOfToday.toISOString(),
    timeMax: new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "250",
  });

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok) return [];
  const data = await res.json();
  return (data.items ?? []) as GCalEvent[];
}

/** Fetch the user's primary-calendar timezone (e.g. "America/New_York"). */
async function getCalendarTimeZone(accessToken: string): Promise<string | null> {
  const res = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return (data.timeZone as string) ?? null;
}

/** True when an ISO datetime carries no offset (e.g. "2026-07-10T14:00:00"). */
function isNaiveDateTime(dt: string): boolean {
  return !/(?:Z|[+-]\d{2}:?\d{2})$/.test(dt);
}

export async function createCalendarEvent(accessToken: string, event: {
  title: string;
  description?: string;
  startDateTime: string;
  endDateTime: string;
  attendeeEmails?: string[];
  addMeetLink?: boolean;
}): Promise<GCalEvent | null> {
  // Google rejects naive datetimes ("Missing time zone definition") — attach
  // the calendar's own timezone so "tomorrow at 2pm" means the user's 2pm.
  let timeZone: string | undefined;
  if (isNaiveDateTime(event.startDateTime) || isNaiveDateTime(event.endDateTime)) {
    timeZone = (await getCalendarTimeZone(accessToken)) ?? "UTC";
  }

  const body: Record<string, unknown> = {
    summary: event.title,
    description: event.description ?? "",
    start: { dateTime: event.startDateTime, ...(timeZone ? { timeZone } : {}) },
    end: { dateTime: event.endDateTime, ...(timeZone ? { timeZone } : {}) },
    attendees: (event.attendeeEmails ?? []).map(email => ({ email })),
  };

  if (event.addMeetLink) {
    body.conferenceData = { createRequest: { requestId: crypto.randomUUID() } };
  }

  const qs = event.addMeetLink ? "?conferenceDataVersion=1" : "";
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events${qs}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) return null;
  return res.json();
}
