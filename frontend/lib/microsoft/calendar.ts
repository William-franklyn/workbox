import { SupabaseClient } from "@supabase/supabase-js";

export interface MSCalEvent {
  id: string;
  subject: string;
  body?: { content: string; contentType: string };
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  attendees?: { emailAddress: { address: string; name?: string }; status?: { response: string } }[];
  isOnlineMeeting?: boolean;
  onlineMeeting?: { joinUrl: string };
  webLink: string;
  isAllDay?: boolean;
}

export async function getValidToken(userId: string, supabase: SupabaseClient): Promise<string | null> {
  const { data: integration } = await supabase
    .from("user_integrations")
    .select("*")
    .eq("user_id", userId)
    .eq("provider", "outlook_calendar")
    .maybeSingle();

  if (!integration?.access_token) return null;

  const expiresAt = integration.token_expires_at ? new Date(integration.token_expires_at) : null;
  const needsRefresh = !expiresAt || expiresAt < new Date(Date.now() + 5 * 60 * 1000);

  if (needsRefresh) {
    if (!integration.refresh_token) return null;

    const res = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.MICROSOFT_CLIENT_ID!,
        client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
        refresh_token: integration.refresh_token,
        grant_type: "refresh_token",
        scope: "Calendars.ReadWrite User.Read offline_access",
      }),
    });

    const data = await res.json();
    if (!data.access_token) return null;

    await supabase.from("user_integrations").update({
      access_token: data.access_token,
      ...(data.refresh_token ? { refresh_token: data.refresh_token } : {}),
      token_expires_at: new Date(Date.now() + (data.expires_in ?? 3600) * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("user_id", userId).eq("provider", "outlook_calendar");

    return data.access_token;
  }

  return integration.access_token;
}

export async function listEvents(accessToken: string, days = 30): Promise<MSCalEvent[]> {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

  const params = new URLSearchParams({
    startDateTime: startOfToday.toISOString(),
    endDateTime: endDate.toISOString(),
    $select: "id,subject,body,start,end,attendees,isOnlineMeeting,onlineMeeting,webLink,isAllDay",
    $orderby: "start/dateTime",
    $top: "250",
  });

  const res = await fetch(
    `https://graph.microsoft.com/v1.0/me/calendarView?${params}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Prefer: `outlook.timezone="UTC"`,
      },
    }
  );

  if (!res.ok) return [];
  const data = await res.json();
  return (data.value ?? []) as MSCalEvent[];
}

export async function createCalendarEvent(accessToken: string, event: {
  title: string;
  description?: string;
  startDateTime: string;
  endDateTime: string;
  attendeeEmails?: string[];
  addTeamsLink?: boolean;
}): Promise<MSCalEvent | null> {
  const body: Record<string, unknown> = {
    subject: event.title,
    body: { contentType: "text", content: event.description ?? "" },
    start: { dateTime: event.startDateTime, timeZone: "UTC" },
    end: { dateTime: event.endDateTime, timeZone: "UTC" },
    attendees: (event.attendeeEmails ?? []).map(email => ({
      emailAddress: { address: email },
      type: "required",
    })),
  };

  if (event.addTeamsLink) {
    body.isOnlineMeeting = true;
    body.onlineMeetingProvider = "teamsForBusiness";
  }

  const res = await fetch("https://graph.microsoft.com/v1.0/me/events", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) return null;
  return res.json();
}
