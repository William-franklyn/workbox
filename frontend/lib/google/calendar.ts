import { SupabaseClient } from "@supabase/supabase-js";

export interface GCalEvent {
  id: string;
  summary: string;
  description?: string;
  start: { dateTime?: string; date?: string; timeZone?: string };
  end: { dateTime?: string; date?: string; timeZone?: string };
  attendees?: { email: string; displayName?: string; responseStatus?: string }[];
  hangoutLink?: string;
  htmlLink: string;
  status: string;
  created?: string;
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
  const params = new URLSearchParams({
    timeMin: new Date().toISOString(),
    timeMax: new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "100",
  });

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok) return [];
  const data = await res.json();
  return (data.items ?? []) as GCalEvent[];
}

export async function createCalendarEvent(accessToken: string, event: {
  title: string;
  description?: string;
  startDateTime: string;
  endDateTime: string;
  attendeeEmails?: string[];
  addMeetLink?: boolean;
}): Promise<GCalEvent | null> {
  const body: Record<string, unknown> = {
    summary: event.title,
    description: event.description ?? "",
    start: { dateTime: event.startDateTime },
    end: { dateTime: event.endDateTime },
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
