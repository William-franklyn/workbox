import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getValidToken, listEvents, createCalendarEvent } from "@/lib/google/calendar";

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const MODEL = "claude-haiku-4-5-20251001";
const MAX_ROUNDS = 5;
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://workbox-blue.vercel.app";

function blocksToText(blocks: unknown[]): string {
  if (!Array.isArray(blocks)) return "";
  return blocks.map(b => {
    const block = b as Record<string, unknown>;
    if (block.type === "table") {
      const headers = (block.headers as string[] ?? []).join(" | ");
      const rows = (block.rows as string[][] ?? []).map(r => r.join(" | ")).join("\n");
      return `${headers}\n${rows}`;
    }
    const content = block.content as Array<{ text?: string }> ?? [];
    return content.map(c => c.text ?? "").join("");
  }).filter(Boolean).join("\n\n");
}

async function getAllowedListIds(supabase: ReturnType<typeof createServiceClient>, orgId: string | null): Promise<string[]> {
  const q = supabase.from("spaces").select("id");
  const { data: spaces } = orgId ? await q.eq("org_id", orgId) : await q;
  const spaceIds = (spaces ?? []).map((s: Record<string, string>) => s.id);
  if (!spaceIds.length) return [];
  const { data: lists } = await supabase.from("lists").select("id").in("space_id", spaceIds);
  return (lists ?? []).map((l: Record<string, string>) => l.id);
}

async function executeTool(
  name: string,
  args: Record<string, unknown>,
  userId: string,
  orgId: string | null,
  senderName: string,
): Promise<string> {
  const supabase = createServiceClient();

  switch (name) {
    case "list_tasks": {
      const ids = args.list_id ? [args.list_id as string] : await getAllowedListIds(supabase, orgId);
      if (!ids.length) return "No tasks found.";
      let q = supabase.from("tasks").select("id, title, status, priority, due_date").in("list_id", ids).order("position");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (args.status) q = (q as any).eq("status", args.status as string);
      const { data } = await q;
      if (!data?.length) return "No tasks found.";
      return (data as Record<string, string>[]).map(t =>
        `• [${t.id}] ${t.title} — ${t.status}${t.priority ? ` (${t.priority})` : ""}${t.due_date ? ` · due ${t.due_date}` : ""}`
      ).join("\n");
    }

    case "create_task": {
      const { title, list_id, status = "todo", priority = "normal", due_date, description } = args as Record<string, string>;
      const { data, error } = await supabase.from("tasks").insert({
        id: crypto.randomUUID(), title, list_id, status, priority,
        due_date: due_date || null, description: description || null,
        created_by: userId, position: 0,
      }).select("id, title").single();
      if (error) return `Error: ${error.message}`;
      return `Created task "${(data as Record<string, string>).title}" (ID: ${(data as Record<string, string>).id})`;
    }

    case "update_task": {
      const { task_id, ...patch } = args as Record<string, unknown>;
      const { error } = await supabase.from("tasks").update(patch).eq("id", task_id as string);
      if (error) return `Error: ${error.message}`;
      return `Task updated.`;
    }

    case "delete_task": {
      const { error } = await supabase.from("tasks").delete().eq("id", args.task_id as string);
      if (error) return `Error: ${error.message}`;
      return "Task deleted.";
    }

    case "list_spaces": {
      const q = supabase.from("spaces").select("id, name, icon, lists(id, name)").order("position");
      const { data } = orgId ? await q.eq("org_id", orgId) : await q;
      if (!data?.length) return "No spaces found.";
      return (data as Record<string, unknown>[]).map(s => {
        const lists = (s.lists as Record<string, string>[] ?? []);
        return `[${s.id}] ${s.icon} ${s.name}\n  Lists: ${lists.map(l => `${l.name} (${l.id})`).join(", ") || "none"}`;
      }).join("\n");
    }

    case "create_space": {
      const { name, icon = "🚀", color = "#7c3aed" } = args as Record<string, string>;
      const { count } = await supabase.from("spaces").select("id", { count: "exact", head: true });
      const { data, error } = await supabase.from("spaces")
        .insert({ id: `s${Date.now()}`, name, icon, color, org_id: orgId, position: count ?? 0 })
        .select("id, name").single();
      if (error) return `Error: ${error.message}`;
      return `Created space "${(data as Record<string, string>).name}" (ID: ${(data as Record<string, string>).id})`;
    }

    case "create_list": {
      const { name, space_id } = args as Record<string, string>;
      const { data, error } = await supabase.from("lists")
        .insert({ id: `l${Date.now()}`, name, space_id, position: 0 })
        .select("id, name").single();
      if (error) return `Error: ${error.message}`;
      return `Created list "${(data as Record<string, string>).name}" (ID: ${(data as Record<string, string>).id})`;
    }

    case "list_docs": {
      const q = supabase.from("docs").select("id, title, updated_at")
        .not("title", "like", "__sheet__%").order("updated_at", { ascending: false });
      const { data } = orgId ? await q.eq("org_id", orgId) : await q;
      if (!data?.length) return "No documents found.";
      return (data as Record<string, string>[]).map(d => `• ${d.title} — ${BASE_URL}/docs/${d.id}`).join("\n");
    }

    case "create_doc": {
      const { title, content = "" } = args as Record<string, string>;
      const blocks = (content as string).split("\n\n").filter(Boolean).map((p: string) => ({
        id: crypto.randomUUID(), type: "paragraph", content: [{ type: "text", text: p }],
      }));
      const docId = crypto.randomUUID();
      const { error } = await supabase.from("docs").insert({ id: docId, title, blocks, org_id: orgId, created_by: userId });
      if (error) return `Error: ${error.message}`;
      return `Created document "${title}" — ${BASE_URL}/docs/${docId}`;
    }

    case "read_doc": {
      const { data } = await supabase.from("docs").select("title, blocks").eq("id", args.doc_id as string).maybeSingle();
      if (!data) return "Document not found.";
      const text = blocksToText((data as Record<string, unknown>).blocks as unknown[] ?? []);
      return `"${(data as Record<string, string>).title}"\n\n${text || "(empty)"}`;
    }

    case "update_doc": {
      const { doc_id, title, content } = args as Record<string, string>;
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (title) patch.title = title;
      if (content) patch.blocks = content.split("\n\n").filter(Boolean).map((p: string) => ({
        id: crypto.randomUUID(), type: "paragraph", content: [{ type: "text", text: p }],
      }));
      const { error } = await supabase.from("docs").update(patch).eq("id", doc_id);
      if (error) return `Error: ${error.message}`;
      return "Document updated.";
    }

    case "delete_doc": {
      await supabase.from("docs").delete().eq("id", args.doc_id as string);
      return "Document deleted.";
    }

    case "list_goals": {
      const q = supabase.from("goals").select("id, title, due_date, key_results(id, title, current_value, target_value, unit)");
      const { data } = orgId ? await q.eq("org_id", orgId) : await q;
      if (!data?.length) return "No goals found.";
      return (data as Record<string, unknown>[]).map(g => {
        const krs = g.key_results as Record<string, number>[] ?? [];
        const pct = krs.length
          ? Math.round(krs.reduce((a, kr) => a + (kr.target_value ? kr.current_value / kr.target_value : 0), 0) / krs.length * 100)
          : 0;
        const krLines = krs.map(kr => `\n  • ${kr.title}: ${kr.current_value}/${kr.target_value} ${kr.unit}`).join("");
        return `[${g.id}] ${g.title} — ${pct}%${g.due_date ? ` (due ${g.due_date})` : ""}${krLines}`;
      }).join("\n\n");
    }

    case "create_goal": {
      const { title, description, due_date } = args as Record<string, string>;
      const key_results = args.key_results as Record<string, unknown>[] ?? [];
      const goalId = crypto.randomUUID();
      const { error } = await supabase.from("goals").insert({ id: goalId, title, description, due_date, org_id: orgId, created_by: userId });
      if (error) return `Error: ${error.message}`;
      if (key_results.length) {
        await supabase.from("key_results").insert(key_results.map(kr => ({
          id: crypto.randomUUID(), goal_id: goalId, title: kr.title, current_value: 0, target_value: kr.target_value, unit: kr.unit,
        })));
      }
      return `Created goal "${title}" (ID: ${goalId})`;
    }

    case "update_goal_progress": {
      const { goal_id, kr_id, current_value } = args as Record<string, unknown>;
      const { error } = await supabase.from("key_results").update({ current_value }).eq("id", kr_id as string).eq("goal_id", goal_id as string);
      if (error) return `Error: ${error.message}`;
      return `Progress updated to ${current_value}.`;
    }

    case "list_members": {
      const q = supabase.from("profiles").select("id, full_name, email, role");
      const { data } = orgId ? await q.eq("organization_id", orgId) : await q;
      if (!data?.length) return "No members found.";
      return (data as Record<string, string>[]).map(m => `[${m.id}] ${m.full_name ?? m.email} — ${m.role}`).join("\n");
    }

    case "get_messages": {
      const limit = (args.limit as number) ?? 20;
      const q = supabase.from("team_messages").select("id, user_id, sender_name, content, mentions, created_at")
        .order("created_at", { ascending: false }).limit(limit);
      const { data: raw } = orgId ? await q.eq("organization_id", orgId) : await q;
      const all = (raw ?? []).reverse() as Record<string, unknown>[];
      if (!all.length) return "No messages yet.";
      const mine = all.filter(m => m.user_id !== userId && ((m.mentions as string[] ?? []).includes(userId) || (m.mentions as string[] ?? []).includes("all")));
      let out = mine.length ? `🔔 ${mine.length} message(s) mentioning you:\n${mine.map(m => `  @${m.sender_name}: "${m.content}"`).join("\n")}\n\n` : "";
      out += `Recent messages:\n${all.slice(-10).map(m => {
        const t = new Date(m.created_at as string).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
        return `  [${t}] ${m.sender_name}: ${m.content}`;
      }).join("\n")}`;
      return out;
    }

    case "send_message": {
      const { content, mention_names = [] } = args as { content: string; mention_names: string[] };
      const mentions: string[] = [];
      let finalContent = content;
      for (const mname of mention_names) {
        if (mname.toLowerCase() === "all") {
          mentions.push("all");
          finalContent = `@all ${finalContent}`;
        } else {
          const { data: mp } = await supabase.from("profiles").select("id, full_name").ilike("full_name", `%${mname}%`).maybeSingle();
          if (mp) {
            mentions.push((mp as Record<string, string>).id);
            finalContent = `@${(mp as Record<string, string>).full_name} ${finalContent}`;
          }
        }
      }
      const { error } = await supabase.from("team_messages").insert({
        id: crypto.randomUUID(), organization_id: orgId, user_id: userId,
        sender_name: senderName, content: finalContent, mentions,
      });
      if (error) return `Error: ${error.message}`;
      return `Message sent${mentions.length ? ` (mentioned: ${mention_names.join(", ")})` : ""}.`;
    }

    case "get_notifications": {
      const limit = (args.limit as number) ?? 20;
      const { data } = await supabase.from("notifications").select("type, title, body, read, created_at")
        .eq("user_id", userId).order("created_at", { ascending: false }).limit(limit);
      if (!data?.length) return "No notifications.";
      return (data as Record<string, unknown>[]).map(n => `[${n.read ? "read" : "UNREAD"}] ${n.title}: ${n.body}`).join("\n");
    }

    case "mark_notifications_read": {
      const q = supabase.from("notifications").update({ read: true }).eq("user_id", userId);
      await (args.id ? q.eq("id", args.id as string) : q);
      return "Marked as read.";
    }

    case "list_meetings": {
      const days = (args.days as number) ?? 14;
      const token = await getValidToken(userId, supabase);
      if (!token) return "Google Calendar not connected. Go to Settings → Integrations to connect.";
      const events = await listEvents(token, days);
      if (!events.length) return "No upcoming meetings.";
      return events.map(e => {
        const start = e.start.dateTime ?? e.start.date;
        return `• ${e.summary} — ${start}${e.hangoutLink ? `\n  Meet: ${e.hangoutLink}` : ""}`;
      }).join("\n");
    }

    case "schedule_meeting": {
      const { title, start, end, description, add_meet_link = true } = args as Record<string, unknown>;
      const attendees = (args.attendees as string[]) ?? [];
      const token = await getValidToken(userId, supabase);
      if (!token) return "Google Calendar not connected. Go to Settings → Integrations to connect.";
      const event = await createCalendarEvent(token, {
        title: title as string, description: description as string,
        startDateTime: start as string, endDateTime: end as string,
        attendeeEmails: attendees, addMeetLink: add_meet_link as boolean,
      });
      if (!event) return "Failed to create meeting.";
      return `Scheduled "${event.summary}" on ${event.start.dateTime}${event.hangoutLink ? `\nMeet link: ${event.hangoutLink}` : ""}`;
    }

    case "get_time_summary": {
      const days = (args.days as number) ?? 7;
      const since = new Date(Date.now() - days * 86_400_000).toISOString();
      const { data } = await supabase.from("time_logs").select("duration_minutes, note, logged_at")
        .eq("user_id", userId).gte("logged_at", since).order("logged_at", { ascending: false });
      if (!data?.length) return `No time logged in the last ${days} days.`;
      const total = (data as Record<string, number>[]).reduce((s, l) => s + l.duration_minutes, 0);
      return `${(total / 60).toFixed(1)}h logged in last ${days} days:\n${
        (data as Record<string, unknown>[]).slice(0, 10).map(l => `• ${Math.round(l.duration_minutes as number)}min${l.note ? ` — ${l.note}` : ""}`).join("\n")
      }`;
    }

    case "log_time": {
      const { task_id, duration_minutes, note } = args as Record<string, unknown>;
      const { error } = await supabase.from("time_logs").insert({
        id: crypto.randomUUID(), task_id, user_id: userId, duration_minutes, note: note || null, logged_at: new Date().toISOString(),
      });
      if (error) return `Error: ${error.message}`;
      return `Logged ${duration_minutes} minutes.`;
    }

    case "list_subtasks": {
      const { data } = await supabase.from("task_subtasks").select("id, title, completed")
        .eq("task_id", args.task_id as string).order("position");
      if (!data?.length) return "No subtasks.";
      return (data as Record<string, unknown>[]).map(s => `[${s.id}] ${s.completed ? "✓" : "○"} ${s.title}`).join("\n");
    }

    case "add_subtask": {
      const { task_id, title } = args as Record<string, string>;
      const { data, error } = await supabase.from("task_subtasks")
        .insert({ id: crypto.randomUUID(), task_id, title, completed: false, position: 0 })
        .select("id").single();
      if (error) return `Error: ${error.message}`;
      return `Added subtask "${title}" (ID: ${(data as Record<string, string>).id})`;
    }

    case "complete_subtask": {
      const { subtask_id, completed = true } = args as Record<string, unknown>;
      const { error } = await supabase.from("task_subtasks").update({ completed }).eq("id", subtask_id as string);
      if (error) return `Error: ${error.message}`;
      return `Subtask ${completed ? "completed" : "uncompleted"}.`;
    }

    case "list_comments": {
      const { data } = await supabase.from("task_comments").select("id, content, created_at")
        .eq("task_id", args.task_id as string).order("created_at");
      if (!data?.length) return "No comments.";
      return (data as Record<string, string>[]).map(c =>
        `[${new Date(c.created_at).toLocaleString()}] ${c.content}`
      ).join("\n");
    }

    case "add_comment": {
      const { task_id, content } = args as Record<string, string>;
      const { error } = await supabase.from("task_comments")
        .insert({ id: crypto.randomUUID(), task_id, user_id: userId, content });
      if (error) return `Error: ${error.message}`;
      return "Comment added.";
    }

    case "list_spreadsheets": {
      const q = supabase.from("docs").select("id, title, blocks, updated_at")
        .like("title", "__sheet__%").order("updated_at", { ascending: false });
      const { data } = orgId ? await q.eq("org_id", orgId) : await q;
      if (!data?.length) return "No spreadsheets found.";
      return (data as Record<string, unknown>[]).map(d => {
        const tb = (d.blocks as Record<string, unknown>[] ?? []).find(b => b.type === "table");
        const rows = (tb?.rows as unknown[] ?? []).length;
        return `• ${(d.title as string).replace("__sheet__", "")} (${rows} rows) — ${BASE_URL}/docs/${d.id} [ID: ${d.id}]`;
      }).join("\n");
    }

    case "create_spreadsheet": {
      const { title, headers = [], rows = [], description } = args as Record<string, unknown>;
      const blocks: unknown[] = [{ id: crypto.randomUUID(), type: "table", headers, rows }];
      if (description) blocks.push({ id: crypto.randomUUID(), type: "paragraph", content: [{ type: "text", text: description }] });
      const docId = crypto.randomUUID();
      const { error } = await supabase.from("docs").insert({ id: docId, title: `__sheet__${title}`, blocks, org_id: orgId, created_by: userId });
      if (error) return `Error: ${error.message}`;
      return `Created spreadsheet "${title}" — ${BASE_URL}/docs/${docId} [ID: ${docId}]`;
    }

    case "read_spreadsheet": {
      const { data } = await supabase.from("docs").select("title, blocks").eq("id", args.spreadsheet_id as string).maybeSingle();
      if (!data) return "Spreadsheet not found.";
      const tb = (((data as Record<string, unknown>).blocks) as Record<string, unknown>[] ?? []).find(b => b.type === "table");
      if (!tb) return "No table data.";
      const title = ((data as Record<string, string>).title).replace("__sheet__", "");
      const header = (tb.headers as string[] ?? []).join(" | ");
      const rowLines = (tb.rows as string[][] ?? []).map(r => r.join(" | ")).join("\n");
      return `"${title}"\n${header}\n${rowLines || "(empty)"}`;
    }

    case "update_spreadsheet": {
      const { spreadsheet_id, rows, headers, title } = args as Record<string, unknown>;
      const { data: doc } = await supabase.from("docs").select("blocks, title").eq("id", spreadsheet_id as string).maybeSingle();
      if (!doc) return "Spreadsheet not found.";
      const blocks = ((doc as Record<string, unknown>).blocks as Record<string, unknown>[] ?? []);
      const ti = blocks.findIndex(b => b.type === "table");
      if (ti >= 0) {
        if (headers) blocks[ti].headers = headers;
        if (rows) blocks[ti].rows = rows;
      } else {
        blocks.unshift({ id: crypto.randomUUID(), type: "table", headers: headers ?? [], rows: rows ?? [] });
      }
      const patch: Record<string, unknown> = { blocks, updated_at: new Date().toISOString() };
      if (title) patch.title = `__sheet__${title}`;
      const { error } = await supabase.from("docs").update(patch).eq("id", spreadsheet_id as string);
      if (error) return `Error: ${error.message}`;
      return "Spreadsheet updated.";
    }

    default:
      return `Unknown tool: ${name}`;
  }
}

// Anthropic tool format: { name, description, input_schema }
const TOOLS = [
  { name: "list_tasks", description: "List all tasks, optionally filtered by list_id or status (todo/in_progress/in_review/done)", input_schema: { type: "object", properties: { list_id: { type: "string" }, status: { type: "string" } }, required: [] } },
  { name: "create_task", description: "Create a new task in a list", input_schema: { type: "object", properties: { title: { type: "string" }, list_id: { type: "string" }, status: { type: "string", description: "todo (default), in_progress, in_review, done" }, priority: { type: "string", description: "urgent, high, normal (default), low" }, due_date: { type: "string", description: "ISO date e.g. 2026-07-01" }, description: { type: "string" } }, required: ["title", "list_id"] } },
  { name: "update_task", description: "Update a task's title, status, priority, due_date, or description", input_schema: { type: "object", properties: { task_id: { type: "string" }, title: { type: "string" }, status: { type: "string" }, priority: { type: "string" }, due_date: { type: "string" }, description: { type: "string" } }, required: ["task_id"] } },
  { name: "delete_task", description: "Delete a task by ID", input_schema: { type: "object", properties: { task_id: { type: "string" } }, required: ["task_id"] } },
  { name: "list_spaces", description: "List all spaces and their lists (with IDs)", input_schema: { type: "object", properties: {}, required: [] } },
  { name: "create_space", description: "Create a new space", input_schema: { type: "object", properties: { name: { type: "string" }, icon: { type: "string" }, color: { type: "string" } }, required: ["name"] } },
  { name: "create_list", description: "Create a new list inside a space", input_schema: { type: "object", properties: { name: { type: "string" }, space_id: { type: "string" } }, required: ["name", "space_id"] } },
  { name: "list_docs", description: "List all documents (title and portal link only)", input_schema: { type: "object", properties: {}, required: [] } },
  { name: "create_doc", description: "Create a new document with optional text content", input_schema: { type: "object", properties: { title: { type: "string" }, content: { type: "string" } }, required: ["title"] } },
  { name: "read_doc", description: "Read the full content of a document", input_schema: { type: "object", properties: { doc_id: { type: "string" } }, required: ["doc_id"] } },
  { name: "update_doc", description: "Update a document's title or content", input_schema: { type: "object", properties: { doc_id: { type: "string" }, title: { type: "string" }, content: { type: "string" } }, required: ["doc_id"] } },
  { name: "delete_doc", description: "Delete a document", input_schema: { type: "object", properties: { doc_id: { type: "string" } }, required: ["doc_id"] } },
  { name: "list_goals", description: "List all goals with key results and progress", input_schema: { type: "object", properties: {}, required: [] } },
  { name: "create_goal", description: "Create a new goal with optional key results", input_schema: { type: "object", properties: { title: { type: "string" }, description: { type: "string" }, due_date: { type: "string" }, key_results: { type: "array", items: { type: "object", properties: { title: { type: "string" }, target_value: { type: "number" }, unit: { type: "string" } } } } }, required: ["title"] } },
  { name: "update_goal_progress", description: "Update a key result's current value", input_schema: { type: "object", properties: { goal_id: { type: "string" }, kr_id: { type: "string" }, current_value: { type: "number" } }, required: ["goal_id", "kr_id", "current_value"] } },
  { name: "list_members", description: "List all workspace members", input_schema: { type: "object", properties: {}, required: [] } },
  { name: "get_messages", description: "Get team chat messages and any that mention you", input_schema: { type: "object", properties: { limit: { type: "number" } }, required: [] } },
  { name: "send_message", description: "Send a message to team chat, optionally mentioning people by name", input_schema: { type: "object", properties: { content: { type: "string" }, mention_names: { type: "array", items: { type: "string" } } }, required: ["content"] } },
  { name: "get_notifications", description: "Get recent notifications", input_schema: { type: "object", properties: { limit: { type: "number" } }, required: [] } },
  { name: "mark_notifications_read", description: "Mark one or all notifications as read", input_schema: { type: "object", properties: { id: { type: "string", description: "Omit to mark all read" } }, required: [] } },
  { name: "list_meetings", description: "List upcoming meetings from Google Calendar", input_schema: { type: "object", properties: { days: { type: "number" } }, required: [] } },
  { name: "schedule_meeting", description: "Schedule a meeting on Google Calendar", input_schema: { type: "object", properties: { title: { type: "string" }, start: { type: "string", description: "ISO datetime e.g. 2026-07-01T14:00:00" }, end: { type: "string" }, attendees: { type: "array", items: { type: "string" }, description: "Email addresses" }, description: { type: "string" }, add_meet_link: { type: "boolean" } }, required: ["title", "start", "end"] } },
  { name: "get_time_summary", description: "Get time tracking summary for recent days", input_schema: { type: "object", properties: { days: { type: "number" } }, required: [] } },
  { name: "log_time", description: "Log time spent on a task", input_schema: { type: "object", properties: { task_id: { type: "string" }, duration_minutes: { type: "number" }, note: { type: "string" } }, required: ["task_id", "duration_minutes"] } },
  { name: "list_subtasks", description: "List subtasks for a task", input_schema: { type: "object", properties: { task_id: { type: "string" } }, required: ["task_id"] } },
  { name: "add_subtask", description: "Add a subtask to a task", input_schema: { type: "object", properties: { task_id: { type: "string" }, title: { type: "string" } }, required: ["task_id", "title"] } },
  { name: "complete_subtask", description: "Mark a subtask complete or incomplete", input_schema: { type: "object", properties: { subtask_id: { type: "string" }, completed: { type: "boolean" } }, required: ["subtask_id"] } },
  { name: "list_comments", description: "List comments on a task", input_schema: { type: "object", properties: { task_id: { type: "string" } }, required: ["task_id"] } },
  { name: "add_comment", description: "Add a comment to a task", input_schema: { type: "object", properties: { task_id: { type: "string" }, content: { type: "string" } }, required: ["task_id", "content"] } },
  { name: "list_spreadsheets", description: "List all spreadsheets", input_schema: { type: "object", properties: {}, required: [] } },
  { name: "create_spreadsheet", description: "Create a spreadsheet with headers and rows of data", input_schema: { type: "object", properties: { title: { type: "string" }, headers: { type: "array", items: { type: "string" } }, rows: { type: "array", items: { type: "array", items: { type: "string" } } }, description: { type: "string" } }, required: ["title", "headers"] } },
  { name: "read_spreadsheet", description: "Read the data from a spreadsheet", input_schema: { type: "object", properties: { spreadsheet_id: { type: "string" } }, required: ["spreadsheet_id"] } },
  { name: "update_spreadsheet", description: "Update a spreadsheet's title, headers, or rows", input_schema: { type: "object", properties: { spreadsheet_id: { type: "string" }, title: { type: "string" }, headers: { type: "array", items: { type: "string" } }, rows: { type: "array", items: { type: "array", items: { type: "string" } } } }, required: ["spreadsheet_id"] } },
];

const SYSTEM_PROMPT = `You are WorkBox Agent — the AI brain built into WorkBox, a project management and productivity platform. You have direct, real-time access to the entire workspace through tools.

You can:
- Read and write tasks (create, update, delete, filter by status/list)
- Manage spaces and lists
- Read, create, update, and delete documents and spreadsheets
- Check and send team chat messages (you can @mention teammates by name)
- View and create goals with key results, track progress
- Check notifications and mark them read
- List and schedule meetings via Google Calendar
- Log time and view time summaries
- Manage subtasks and comments on tasks

## Topic focus — IMPORTANT
Your purpose is to help users be more productive at work using WorkBox. You only help with:
- Work, tasks, projects, and productivity
- Anything inside the user's WorkBox workspace (tasks, docs, goals, meetings, teammates, messages)
- General professional topics: time management, prioritisation, team communication, goal setting

If a user asks about anything outside this scope — food, entertainment, personal lifestyle, general knowledge, trivia, coding unrelated to their work, creative writing for fun, etc. — do NOT answer it. Instead, warmly redirect them by:
1. Briefly acknowledging what they asked (one sentence, no judgement)
2. Pivoting to something concrete you CAN help them with right now

Keep redirects light and helpful, never preachy or robotic.

## Operational rules
- For documents: when listing, show name + link only. Only fetch content (read_doc) if the user explicitly asks to read or view it.
- For messages: when the user says "tell X [message]", use send_message with mention_names to address them directly.
- Always use tools to get real data — never guess or make up task names, IDs, or content.
- After taking an action (create, update, delete, send), confirm it to the user concisely.
- Today's date is ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}.`;

type AnthropicBlock = { type: string; text?: string; id?: string; name?: string; input?: Record<string, unknown> };

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey || apiKey === "your_anthropic_api_key_here") {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = user.id;
    const svcClient = createServiceClient();
    const { data: profile } = await svcClient.from("profiles")
      .select("organization_id, full_name").eq("id", userId).maybeSingle();
    const orgId = (profile as Record<string, unknown> | null)?.organization_id as string | null ?? null;
    const senderName = (profile as Record<string, string> | null)?.full_name ?? user.email?.split("@")[0] ?? "User";

    const { messages } = await req.json();
    // Anthropic doesn't accept system in the messages array — it's a top-level param
    const anthropicMessages: Record<string, unknown>[] = (messages as Record<string, unknown>[])
      .slice(-12)
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role, content: m.content }));

    for (let round = 0; round < MAX_ROUNDS; round++) {
      const res = await fetch(ANTHROPIC_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": ANTHROPIC_VERSION,
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 1024,
          system: SYSTEM_PROMPT,
          tools: TOOLS,
          tool_choice: { type: "auto" },
          messages: anthropicMessages,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const errMsg = (err as Record<string, Record<string, string>>).error?.message ?? `HTTP ${res.status}`;
        return NextResponse.json({ content: `Something went wrong: ${errMsg}` });
      }

      const data = await res.json();
      const content = data.content as AnthropicBlock[];
      const stopReason = data.stop_reason as string;

      const toolUseBlocks = content.filter((b) => b.type === "tool_use");

      // No tool calls — return final text
      if (stopReason !== "tool_use" || !toolUseBlocks.length) {
        const text = content.find((b) => b.type === "text")?.text;
        return NextResponse.json({ content: text || "I've completed the requested actions." });
      }

      // Add assistant turn (includes tool_use blocks)
      anthropicMessages.push({ role: "assistant", content });

      // Execute all tools, gather results into a single user turn
      const toolResults: Record<string, unknown>[] = [];
      for (const block of toolUseBlocks) {
        const result = await executeTool(block.name!, block.input ?? {}, userId, orgId, senderName);
        toolResults.push({ type: "tool_result", tool_use_id: block.id, content: result });
      }
      anthropicMessages.push({ role: "user", content: toolResults });
    }

    return NextResponse.json({ content: "I've completed the requested actions." });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[agent] error:", msg);
    return NextResponse.json({ error: msg || "Unexpected server error" }, { status: 500 });
  }
}
