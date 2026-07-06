import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getValidToken, listEvents } from "@/lib/google/calendar";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const svc = createServiceClient();
    const { data: profile } = await svc
      .from("profiles")
      .select("full_name, organization_id")
      .eq("id", user.id)
      .maybeSingle();

    const orgId = (profile as any)?.organization_id;
    const today = new Date().toISOString().slice(0, 10);

    // Fetch all tasks for the org
    let taskQuery = svc.from("tasks").select("id, status, priority, due_date");
    if (orgId) {
      const { data: spaceRows } = await svc.from("spaces").select("id").eq("org_id", orgId);
      if (spaceRows?.length) {
        const { data: listRows } = await svc
          .from("lists")
          .select("id")
          .in("space_id", spaceRows.map((s: any) => s.id));
        if (listRows?.length) {
          taskQuery = (taskQuery as any).in("list_id", listRows.map((l: any) => l.id));
        }
      }
    }

    const { data: tasks } = await taskQuery;
    const all = tasks ?? [];

    const overdue = all.filter((t: any) => t.due_date && t.due_date < today && t.status !== "done").length;
    const dueToday = all.filter((t: any) => t.due_date === today && t.status !== "done").length;
    const inProgress = all.filter((t: any) => t.status === "in_progress").length;
    const urgent = all.filter((t: any) => t.priority === "urgent" && t.status !== "done").length;
    const done = all.filter((t: any) => t.status === "done").length;

    // Today's calendar events
    let meetingCount = 0;
    try {
      const token = await getValidToken(user.id, supabase);
      if (token) {
        const events = await listEvents(token, 1);
        meetingCount = events.filter((e: any) => {
          const start = e.start?.dateTime ?? e.start?.date ?? "";
          return start.startsWith(today);
        }).length;
      }
    } catch { /* calendar not connected */ }

    const stats = { overdue, dueToday, inProgress, urgent, done, meetings: meetingCount };

    // Build context for AI
    const parts: string[] = [];
    if (overdue > 0) parts.push(`${overdue} overdue task${overdue !== 1 ? "s" : ""}`);
    if (dueToday > 0) parts.push(`${dueToday} task${dueToday !== 1 ? "s" : ""} due today`);
    if (urgent > 0) parts.push(`${urgent} urgent task${urgent !== 1 ? "s" : ""}`);
    if (inProgress > 0) parts.push(`${inProgress} task${inProgress !== 1 ? "s" : ""} in progress`);
    if (meetingCount > 0) parts.push(`${meetingCount} meeting${meetingCount !== 1 ? "s" : ""} on the calendar`);

    if (!parts.length) {
      return NextResponse.json({ brief: "Workspace is clear — a great time to plan ahead or tackle the backlog.", stats });
    }

    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) {
      return NextResponse.json({ brief: `On your plate today: ${parts.join(", ")}.`, stats });
    }

    const dateStr = new Date().toLocaleDateString("en-US", {
      weekday: "long", month: "long", day: "numeric",
    });

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${groqKey}` },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [{
          role: "user",
          content: `Write a 1-2 sentence work briefing. Today: ${dateStr}. Status: ${parts.join("; ")}. No greeting, no filler — direct and motivating.`,
        }],
        max_tokens: 80,
        temperature: 0.5,
      }),
    });

    let brief = `On your plate today: ${parts.join(", ")}.`;
    if (res.ok) {
      const json = await res.json();
      const c = json.choices?.[0]?.message?.content?.trim();
      if (c) brief = c.replace(/^["']|["']$/g, "");
    }

    return NextResponse.json({ brief, stats });
  } catch {
    return NextResponse.json({ brief: "Have a productive day — your workspace is ready.", stats: {} });
  }
}
