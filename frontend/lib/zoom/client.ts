import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Zoom OAuth + meeting helpers. Env: ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET. */

export function zoomConfigured(): boolean {
  return !!process.env.ZOOM_CLIENT_ID && !!process.env.ZOOM_CLIENT_SECRET;
}

function basicAuth(): string {
  return Buffer.from(`${process.env.ZOOM_CLIENT_ID}:${process.env.ZOOM_CLIENT_SECRET}`).toString("base64");
}

/** Valid access token for the user, refreshing if needed. Null if not connected. */
export async function getValidZoomToken(userId: string, supabase: SupabaseClient): Promise<string | null> {
  const { data: integration } = await supabase
    .from("user_integrations")
    .select("access_token, refresh_token, token_expires_at")
    .eq("user_id", userId).eq("provider", "zoom").maybeSingle();

  if (!integration?.access_token) return null;

  const expiresAt = integration.token_expires_at ? new Date(integration.token_expires_at) : null;
  const needsRefresh = !expiresAt || expiresAt < new Date(Date.now() + 5 * 60 * 1000);
  if (!needsRefresh) return integration.access_token;
  if (!integration.refresh_token) return null;

  const res = await fetch("https://zoom.us/oauth/token", {
    method: "POST",
    headers: { Authorization: `Basic ${basicAuth()}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: integration.refresh_token }),
  });
  const data = await res.json();
  if (!data.access_token) return null;

  await supabase.from("user_integrations").update({
    access_token: data.access_token,
    refresh_token: data.refresh_token ?? integration.refresh_token,
    token_expires_at: new Date(Date.now() + (data.expires_in ?? 3600) * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("user_id", userId).eq("provider", "zoom");

  return data.access_token;
}

export interface ZoomMeeting { id: string; join_url: string; start_url: string; topic: string; }

/** Create an instant Zoom meeting (type 1) for the user. */
export async function createInstantMeeting(accessToken: string, topic = "WorkBox Instant Meeting"): Promise<ZoomMeeting | null> {
  const res = await fetch("https://api.zoom.us/v2/users/me/meetings", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ topic, type: 1, settings: { join_before_host: true, waiting_room: false } }),
  });
  if (!res.ok) return null;
  const d = await res.json();
  return { id: String(d.id), join_url: d.join_url, start_url: d.start_url, topic: d.topic };
}
