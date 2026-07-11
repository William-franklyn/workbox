import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getValidZoomToken, createInstantMeeting, zoomConfigured } from "@/lib/zoom/client";

/** POST /api/zoom/instant-meeting — start an instant Zoom meeting. */
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!zoomConfigured()) {
    return NextResponse.json({ error: "Zoom isn't configured on this workspace yet." }, { status: 503 });
  }

  const token = await getValidZoomToken(user.id, supabase);
  if (!token) {
    return NextResponse.json({ error: "Connect your Zoom account first.", needsConnect: true }, { status: 400 });
  }

  const meeting = await createInstantMeeting(token);
  if (!meeting) return NextResponse.json({ error: "Couldn't start a Zoom meeting. Try reconnecting Zoom." }, { status: 502 });

  return NextResponse.json({ join_url: meeting.join_url, start_url: meeting.start_url, id: meeting.id });
}
