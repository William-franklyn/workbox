import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getValidToken, listEvents } from "@/lib/google/calendar";
import { cache } from "@/lib/redis";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { success: rlOk, headers: rlHeaders } = await rateLimit(user.id, "ai");
    if (!rlOk) return rateLimitResponse(rlHeaders);

    const result = await cache(`brief:${user.id}`, 60, async () => {
      const svc = createServiceClient();
      const { data: profile } = await svc
        .from("profiles")
        .select("full_name, organization_id")
        .eq("id", user.id)
        .maybeSingle();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const orgId = (profile as any)?.organization_id;
      const today = new Date().toISOString().slice(0, 10);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let taskQuery = svc.from("tasks").select("id, status, priority, due_date") as any;
      if (orgId) {
        const { data: spaceRows } = await svc.from("spaces").select("id").eq("org_id", orgId);
        if (spaceRows?.length) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: listRows } = await svc.from("lists").select("id").in("space_id", (spaceRows as any[]).map((s) => s.id));
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if (listRows?.length) taskQuery = taskQuery.in("list_id", (listRows as any[]).map((l) => l.id));
        }
      }

      const { data: tasks } = await taskQuery;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const all: any[] = tasks ?? [];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const overdue    = all.filter((t: any) => t.due_date && t.due_date < today && t.status !== "done").length;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dueToday   = all.filter((t: any) => t.due_date === today && t.status !== "done").length;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const inProgress = all.filter((t: any) => t.status === "in_progress").length;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const urgent     = all.filter((t: any) => t.priority === "urgent" && t.status !== "done").length;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const done       = all.filter((t: any) => t.status === "done").length;

      let meetingCount = 0;
      try {
        const token = await getValidToken(user.id, supabase);
        if (token) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const events = await listEvents(token, 1);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          meetingCount = events.filter((e: any) => {
            const start = e.start?.dateTime ?? e.start?.date ?? "";
            return start.startsWith(today);
          }).length;
        }
      } catch { /* calendar not connected */ }

      const stats = { overdue, dueToday, inProgress, urgent, done, meetings: meetingCount };

      const parts: string[] = [];
      if (overdue > 0)     parts.push(`${overdue} overdue task${overdue !== 1 ? "s" : ""}`);
      if (dueToday > 0)    parts.push(`${dueToday} task${dueToday !== 1 ? "s" : ""} due today`);
      if (urgent > 0)      parts.push(`${urgent} urgent task${urgent !== 1 ? "s" : ""}`);
      if (inProgress > 0)  parts.push(`${inProgress} task${inProgress !== 1 ? "s" : ""} in progress`);
      if (meetingCount > 0) parts.push(`${meetingCount} meeting${meetingCount !== 1 ? "s" : ""} on the calendar`);

      if (!parts.length) return { brief: "Workspace is clear — a great time to plan ahead or tackle the backlog.", stats };

      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey || apiKey === "your_anthropic_api_key_here") {
        return { brief: `On your plate today: ${parts.join(", ")}.`, stats };
      }

      const dateStr = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 80,
          messages: [{ role: "user", content: `Write a 1-2 sentence work briefing. Today: ${dateStr}. Status: ${parts.join("; ")}. No greeting, no filler — direct and motivating.` }],
        }),
      });

      let brief = `On your plate today: ${parts.join(", ")}.`;
      if (res.ok) {
        const json = await res.json();
        const c = (json.content as Array<{ type: string; text?: string }>)?.find(b => b.type === "text")?.text?.trim();
        if (c) brief = c.replace(/^["']|["']$/g, "");
      }

      return { brief, stats };
    });

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ brief: "Have a productive day — your workspace is ready.", stats: {} });
  }
}
