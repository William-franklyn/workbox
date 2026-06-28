import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function stripHtml(raw: string): string {
  return (raw ?? "")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { googleEventId, title, description, startDateTime, dueDate, meetLink, calendarLink, listId } = await req.json();
  if (!listId) return NextResponse.json({ error: "listId required" }, { status: 400 });

  const { data: existing } = await supabase
    .from("calendar_sync")
    .select("task_id")
    .eq("user_id", user.id)
    .eq("google_event_id", googleEventId)
    .maybeSingle();

  if (existing) return NextResponse.json({ alreadySynced: true, task_id: existing.task_id });

  const cleanDesc = stripHtml(description ?? "");
  const meetLine = meetLink ? `Meet link: ${meetLink}` : "";
  const parts = [cleanDesc, meetLine, `Calendar: ${calendarLink}`].filter(Boolean);

  const { data: task, error } = await supabase.from("tasks").insert({
    title: `📅 ${title}`,
    description: parts.join("\n"),
    status: "todo",
    priority: "normal",
    list_id: listId,
    due_date: dueDate ?? null,
    position: 0,
    created_by: user.id,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from("calendar_sync").upsert(
    { user_id: user.id, google_event_id: googleEventId, task_id: task.id },
    { onConflict: "user_id,google_event_id" }
  );

  return NextResponse.json({ task });
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json([]);

  const { data } = await supabase
    .from("calendar_sync")
    .select("google_event_id, task_id")
    .eq("user_id", user.id);

  return NextResponse.json(data ?? []);
}
