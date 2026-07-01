import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const GROQ_API = "https://api.groq.com/openai/v1/chat/completions";
const MODELS = ["llama-3.3-70b-versatile", "llama-3.1-70b-versatile", "llama-3.1-8b-instant"];
const MAX_ROUNDS = 3;
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://workbox-blue.vercel.app";
const AGENT_API_KEY = process.env.WORKBOX_AGENT_API_KEY ?? "";

async function v1<T = Record<string, unknown>>(
  method: string,
  path: string,
  body?: unknown,
  params?: Record<string, string | number | undefined>,
): Promise<{ data: T | null; error: string | null }> {
  const url = new URL(`${BASE_URL}/api/v1/${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  }
  try {
    const res = await fetch(url.toString(), {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${AGENT_API_KEY}`,
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const json = await res.json();
    if (!res.ok) return { data: null, error: json.error ?? `HTTP ${res.status}` };
    return { data: json as T, error: null };
  } catch (e) {
    return { data: null, error: (e as Error).message };
  }
}

async function executeTool(name: string, args: Record<string, unknown>): Promise<string> {
  switch (name) {
    case "list_tasks": {
      const { data, error } = await v1("GET", "tasks", undefined, {
        list_id: args.list_id as string | undefined,
        status: args.status as string | undefined,
      });
      if (error) return `Error: ${error}`;
      const tasks = (data as Record<string, unknown>).tasks as Record<string, string>[] ?? [];
      if (!tasks.length) return "No tasks found.";
      return tasks.map(t =>
        `• [${t.id}] ${t.title} — ${t.status}${t.priority ? ` (${t.priority})` : ""}${t.due_date ? ` · due ${t.due_date}` : ""}`
      ).join("\n");
    }

    case "create_task": {
      const { data, error } = await v1("POST", "tasks", args);
      if (error) return `Error: ${error}`;
      const task = (data as Record<string, unknown>).task as Record<string, string>;
      return `Created task "${task.title}" (ID: ${task.id})`;
    }

    case "update_task": {
      const { task_id, ...patch } = args;
      const { error } = await v1("PATCH", `tasks/${task_id}`, patch);
      if (error) return `Error: ${error}`;
      return "Task updated.";
    }

    case "delete_task": {
      const { error } = await v1("DELETE", `tasks/${args.task_id}`);
      if (error) return `Error: ${error}`;
      return "Task deleted.";
    }

    case "list_spaces": {
      const { data, error } = await v1("GET", "spaces");
      if (error) return `Error: ${error}`;
      const spaces = (data as Record<string, unknown>).spaces as Record<string, unknown>[] ?? [];
      if (!spaces.length) return "No spaces found.";
      return spaces.map(s => {
        const lists = (s.lists as Record<string, string>[] ?? []);
        return `[${s.id}] ${s.name}\n  Lists: ${lists.map(l => `${l.name} (${l.id})`).join(", ") || "none"}`;
      }).join("\n");
    }

    case "create_space": {
      const { data, error } = await v1("POST", "spaces", args);
      if (error) return `Error: ${error}`;
      const space = (data as Record<string, unknown>).space as Record<string, string>;
      return `Created space "${space.name}" (ID: ${space.id})`;
    }

    case "create_list": {
      const { data, error } = await v1("POST", "lists", args);
      if (error) return `Error: ${error}`;
      const list = (data as Record<string, unknown>).list as Record<string, string>;
      return `Created list "${list.name}" (ID: ${list.id})`;
    }

    case "list_docs": {
      const { data, error } = await v1("GET", "docs");
      if (error) return `Error: ${error}`;
      const docs = (data as Record<string, unknown>).docs as Record<string, string>[] ?? [];
      if (!docs.length) return "No documents found.";
      return docs.map(d => `• ${d.title} — ${d.portal_link}`).join("\n");
    }

    case "create_doc": {
      const { data, error } = await v1("POST", "docs", args);
      if (error) return `Error: ${error}`;
      const doc = (data as Record<string, unknown>).doc as Record<string, string>;
      return `Created document "${doc.title}" — ${doc.portal_link}`;
    }

    case "read_doc": {
      const { data, error } = await v1("GET", `docs/${args.doc_id}`);
      if (error) return `Document not found or error: ${error}`;
      const doc = data as Record<string, string>;
      return `"${doc.title}"\n\n${doc.content || "(empty)"}`;
    }

    case "update_doc": {
      const { doc_id, ...patch } = args;
      const { error } = await v1("PATCH", `docs/${doc_id}`, patch);
      if (error) return `Error: ${error}`;
      return "Document updated.";
    }

    case "delete_doc": {
      const { error } = await v1("DELETE", `docs/${args.doc_id}`);
      if (error) return `Error: ${error}`;
      return "Document deleted.";
    }

    case "list_goals": {
      const { data, error } = await v1("GET", "goals");
      if (error) return `Error: ${error}`;
      const goals = (data as Record<string, unknown>).goals as Record<string, unknown>[] ?? [];
      if (!goals.length) return "No goals found.";
      return goals.map(g => {
        const krs = g.key_results as Record<string, unknown>[] ?? [];
        const krLines = krs.map(kr => `\n  • ${kr.title}: ${kr.current_value}/${kr.target_value} ${kr.unit}`).join("");
        return `[${g.id}] ${g.title} — ${g.progress_pct}%${g.due_date ? ` (due ${g.due_date})` : ""}${krLines}`;
      }).join("\n\n");
    }

    case "create_goal": {
      const { data, error } = await v1("POST", "goals", args);
      if (error) return `Error: ${error}`;
      const goal = (data as Record<string, unknown>).goal as Record<string, string>;
      return `Created goal "${goal.title}" (ID: ${goal.id})`;
    }

    case "update_goal_progress": {
      const { goal_id, ...patch } = args;
      const { error } = await v1("PATCH", `goals/${goal_id}`, patch);
      if (error) return `Error: ${error}`;
      return `Progress updated to ${args.current_value}.`;
    }

    case "list_members": {
      const { data, error } = await v1("GET", "members");
      if (error) return `Error: ${error}`;
      const members = (data as Record<string, unknown>).members as Record<string, string>[] ?? [];
      if (!members.length) return "No members found.";
      return members.map(m => `[${m.id}] ${m.full_name ?? m.email} — ${m.role}`).join("\n");
    }

    case "get_messages": {
      const { data, error } = await v1("GET", "messages", undefined, {
        limit: args.limit as number | undefined,
      });
      if (error) return `Error: ${error}`;
      const d = data as Record<string, unknown>;
      const all = d.messages as Record<string, unknown>[] ?? [];
      const mentions = d.mentions_me as Record<string, unknown>[] ?? [];
      if (!all.length) return "No messages yet.";
      let out = mentions.length
        ? `🔔 ${mentions.length} message(s) mentioning you:\n${mentions.map(m => `  @${m.sender_name}: "${m.content}"`).join("\n")}\n\n`
        : "";
      out += `Recent messages:\n${all.slice(-10).map(m => {
        const t = new Date(m.created_at as string).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
        return `  [${t}] ${m.sender_name}: ${m.content}`;
      }).join("\n")}`;
      return out;
    }

    case "send_message": {
      const { error } = await v1("POST", "messages", args);
      if (error) return `Error: ${error}`;
      return "Message sent.";
    }

    case "get_notifications": {
      const { data, error } = await v1("GET", "notifications");
      if (error) return `Error: ${error}`;
      const notifications = (data as Record<string, unknown>).notifications as Record<string, unknown>[] ?? [];
      if (!notifications.length) return "No notifications.";
      return notifications.slice(0, (args.limit as number) ?? 20)
        .map(n => `[${n.read ? "read" : "UNREAD"}] ${n.title}: ${n.body}`).join("\n");
    }

    case "mark_notifications_read": {
      const body = args.id ? { id: args.id } : { mark_all_read: true };
      const { error } = await v1("PATCH", "notifications", body);
      if (error) return `Error: ${error}`;
      return "Marked as read.";
    }

    case "list_meetings": {
      const { data, error } = await v1("GET", "meetings", undefined, {
        days: args.days as number | undefined,
      });
      if (error) {
        if (error.includes("not connected")) return "Google Calendar not connected. Go to Settings → Integrations to connect.";
        return `Error: ${error}`;
      }
      const meetings = (data as Record<string, unknown>).meetings as Record<string, unknown>[] ?? [];
      if (!meetings.length) return "No upcoming meetings.";
      return meetings.map(e =>
        `• ${e.title} — ${e.start}${e.meet_link ? `\n  Meet: ${e.meet_link}` : ""}`
      ).join("\n");
    }

    case "schedule_meeting": {
      const { data, error } = await v1("POST", "meetings", args);
      if (error) {
        if (error.includes("not connected")) return "Google Calendar not connected. Go to Settings → Integrations to connect.";
        return `Error: ${error}`;
      }
      const meeting = (data as Record<string, unknown>).meeting as Record<string, string>;
      return `Scheduled "${meeting.title}" on ${meeting.start}${meeting.meet_link ? `\nMeet link: ${meeting.meet_link}` : ""}`;
    }

    case "get_time_summary": {
      const { data, error } = await v1("GET", "time-logs");
      if (error) return `Error: ${error}`;
      const d = data as Record<string, unknown>;
      const logs = d.time_logs as Record<string, unknown>[] ?? [];
      const days = (args.days as number) ?? 7;
      const since = new Date(Date.now() - days * 86_400_000);
      const recent = logs.filter(l => new Date(l.logged_at as string) >= since);
      if (!recent.length) return `No time logged in the last ${days} days.`;
      const total = recent.reduce((s, l) => s + (l.duration_minutes as number), 0);
      return `${(total / 60).toFixed(1)}h logged in last ${days} days:\n${
        recent.slice(0, 10).map(l => `• ${Math.round(l.duration_minutes as number)}min${l.note ? ` — ${l.note}` : ""}`).join("\n")
      }`;
    }

    case "log_time": {
      const { error } = await v1("POST", "time-logs", args);
      if (error) return `Error: ${error}`;
      return `Logged ${args.duration_minutes} minutes.`;
    }

    case "list_subtasks": {
      const { data, error } = await v1("GET", "subtasks", undefined, {
        task_id: args.task_id as string,
      });
      if (error) return `Error: ${error}`;
      const subtasks = (data as Record<string, unknown>).subtasks as Record<string, unknown>[] ?? [];
      if (!subtasks.length) return "No subtasks.";
      return subtasks.map(s => `[${s.id}] ${s.completed ? "✓" : "○"} ${s.title}`).join("\n");
    }

    case "add_subtask": {
      const { data, error } = await v1("POST", "subtasks", args);
      if (error) return `Error: ${error}`;
      const subtask = (data as Record<string, unknown>).subtask as Record<string, string>;
      return `Added subtask "${subtask.title}" (ID: ${subtask.id})`;
    }

    case "complete_subtask": {
      const { subtask_id, completed = true } = args;
      const { error } = await v1("PATCH", "subtasks", { id: subtask_id, completed });
      if (error) return `Error: ${error}`;
      return `Subtask ${completed ? "completed" : "uncompleted"}.`;
    }

    case "list_comments": {
      const { data, error } = await v1("GET", "comments", undefined, {
        task_id: args.task_id as string,
      });
      if (error) return `Error: ${error}`;
      const comments = (data as Record<string, unknown>).comments as Record<string, string>[] ?? [];
      if (!comments.length) return "No comments.";
      return comments.map(c => `[${new Date(c.created_at).toLocaleString()}] ${c.content}`).join("\n");
    }

    case "add_comment": {
      const { error } = await v1("POST", "comments", args);
      if (error) return `Error: ${error}`;
      return "Comment added.";
    }

    case "list_spreadsheets": {
      const { data, error } = await v1("GET", "spreadsheets");
      if (error) return `Error: ${error}`;
      const sheets = (data as Record<string, unknown>).spreadsheets as Record<string, unknown>[] ?? [];
      if (!sheets.length) return "No spreadsheets found.";
      return sheets.map(d =>
        `• ${d.title} (${d.row_count} rows) — ${d.portal_link} [ID: ${d.id}]`
      ).join("\n");
    }

    case "create_spreadsheet": {
      const { data, error } = await v1("POST", "spreadsheets", args);
      if (error) return `Error: ${error}`;
      const sheet = (data as Record<string, unknown>).spreadsheet as Record<string, string>;
      return `Created spreadsheet "${sheet.title}" — ${sheet.portal_link} [ID: ${sheet.id}]`;
    }

    case "read_spreadsheet": {
      const { data, error } = await v1("GET", `spreadsheets/${args.spreadsheet_id}`);
      if (error) return `Spreadsheet not found: ${error}`;
      const sheet = data as Record<string, unknown>;
      const header = (sheet.headers as string[] ?? []).join(" | ");
      const rowLines = (sheet.rows as string[][] ?? []).map(r => r.join(" | ")).join("\n");
      return `"${sheet.title}"\n${header}\n${rowLines || "(empty)"}`;
    }

    case "update_spreadsheet": {
      const { spreadsheet_id, ...patch } = args;
      const { error } = await v1("PATCH", `spreadsheets/${spreadsheet_id}`, patch);
      if (error) return `Error: ${error}`;
      return "Spreadsheet updated.";
    }

    default:
      return `Unknown tool: ${name}`;
  }
}

const TOOLS = [
  { type: "function", function: { name: "list_tasks", description: "List all tasks, optionally filtered by list_id or status (todo/in_progress/in_review/done)", parameters: { type: "object", properties: { list_id: { type: "string" }, status: { type: "string" } }, required: [] } } },
  { type: "function", function: { name: "create_task", description: "Create a new task in a list", parameters: { type: "object", properties: { title: { type: "string" }, list_id: { type: "string" }, status: { type: "string", description: "todo (default), in_progress, in_review, done" }, priority: { type: "string", description: "urgent, high, normal (default), low" }, due_date: { type: "string", description: "ISO date e.g. 2026-07-01" }, description: { type: "string" } }, required: ["title", "list_id"] } } },
  { type: "function", function: { name: "update_task", description: "Update a task's title, status, priority, due_date, or description", parameters: { type: "object", properties: { task_id: { type: "string" }, title: { type: "string" }, status: { type: "string" }, priority: { type: "string" }, due_date: { type: "string" }, description: { type: "string" } }, required: ["task_id"] } } },
  { type: "function", function: { name: "delete_task", description: "Delete a task by ID", parameters: { type: "object", properties: { task_id: { type: "string" } }, required: ["task_id"] } } },
  { type: "function", function: { name: "list_spaces", description: "List all spaces and their lists (with IDs)", parameters: { type: "object", properties: {}, required: [] } } },
  { type: "function", function: { name: "create_space", description: "Create a new space", parameters: { type: "object", properties: { name: { type: "string" }, icon: { type: "string" }, color: { type: "string" } }, required: ["name"] } } },
  { type: "function", function: { name: "create_list", description: "Create a new list inside a space", parameters: { type: "object", properties: { name: { type: "string" }, space_id: { type: "string" } }, required: ["name", "space_id"] } } },
  { type: "function", function: { name: "list_docs", description: "List all documents (title and portal link only)", parameters: { type: "object", properties: {}, required: [] } } },
  { type: "function", function: { name: "create_doc", description: "Create a new document with optional text content", parameters: { type: "object", properties: { title: { type: "string" }, content: { type: "string" } }, required: ["title"] } } },
  { type: "function", function: { name: "read_doc", description: "Read the full content of a document", parameters: { type: "object", properties: { doc_id: { type: "string" } }, required: ["doc_id"] } } },
  { type: "function", function: { name: "update_doc", description: "Update a document's title or content", parameters: { type: "object", properties: { doc_id: { type: "string" }, title: { type: "string" }, content: { type: "string" } }, required: ["doc_id"] } } },
  { type: "function", function: { name: "delete_doc", description: "Delete a document", parameters: { type: "object", properties: { doc_id: { type: "string" } }, required: ["doc_id"] } } },
  { type: "function", function: { name: "list_goals", description: "List all goals with key results and progress", parameters: { type: "object", properties: {}, required: [] } } },
  { type: "function", function: { name: "create_goal", description: "Create a new goal with optional key results", parameters: { type: "object", properties: { title: { type: "string" }, description: { type: "string" }, due_date: { type: "string" }, key_results: { type: "array", items: { type: "object", properties: { title: { type: "string" }, target_value: { type: "number" }, unit: { type: "string" } } } } }, required: ["title"] } } },
  { type: "function", function: { name: "update_goal_progress", description: "Update a key result's current value", parameters: { type: "object", properties: { goal_id: { type: "string" }, kr_id: { type: "string" }, current_value: { type: "number" } }, required: ["goal_id", "kr_id", "current_value"] } } },
  { type: "function", function: { name: "list_members", description: "List all workspace members", parameters: { type: "object", properties: {}, required: [] } } },
  { type: "function", function: { name: "get_messages", description: "Get team chat messages and any that mention you", parameters: { type: "object", properties: { limit: { type: "number" } }, required: [] } } },
  { type: "function", function: { name: "send_message", description: "Send a message to team chat, optionally mentioning people by name", parameters: { type: "object", properties: { content: { type: "string" }, mention_names: { type: "array", items: { type: "string" } } }, required: ["content"] } } },
  { type: "function", function: { name: "get_notifications", description: "Get recent notifications", parameters: { type: "object", properties: { limit: { type: "number" } }, required: [] } } },
  { type: "function", function: { name: "mark_notifications_read", description: "Mark one or all notifications as read", parameters: { type: "object", properties: { id: { type: "string", description: "Omit to mark all read" } }, required: [] } } },
  { type: "function", function: { name: "list_meetings", description: "List upcoming meetings from Google Calendar", parameters: { type: "object", properties: { days: { type: "number" } }, required: [] } } },
  { type: "function", function: { name: "schedule_meeting", description: "Schedule a meeting on Google Calendar", parameters: { type: "object", properties: { title: { type: "string" }, start: { type: "string", description: "ISO datetime e.g. 2026-07-01T14:00:00" }, end: { type: "string" }, attendees: { type: "array", items: { type: "string" }, description: "Email addresses" }, description: { type: "string" }, add_meet_link: { type: "boolean" } }, required: ["title", "start", "end"] } } },
  { type: "function", function: { name: "get_time_summary", description: "Get time tracking summary for recent days", parameters: { type: "object", properties: { days: { type: "number" } }, required: [] } } },
  { type: "function", function: { name: "log_time", description: "Log time spent on a task", parameters: { type: "object", properties: { task_id: { type: "string" }, duration_minutes: { type: "number" }, note: { type: "string" } }, required: ["task_id", "duration_minutes"] } } },
  { type: "function", function: { name: "list_subtasks", description: "List subtasks for a task", parameters: { type: "object", properties: { task_id: { type: "string" } }, required: ["task_id"] } } },
  { type: "function", function: { name: "add_subtask", description: "Add a subtask to a task", parameters: { type: "object", properties: { task_id: { type: "string" }, title: { type: "string" } }, required: ["task_id", "title"] } } },
  { type: "function", function: { name: "complete_subtask", description: "Mark a subtask complete or incomplete", parameters: { type: "object", properties: { subtask_id: { type: "string" }, completed: { type: "boolean" } }, required: ["subtask_id"] } } },
  { type: "function", function: { name: "list_comments", description: "List comments on a task", parameters: { type: "object", properties: { task_id: { type: "string" } }, required: ["task_id"] } } },
  { type: "function", function: { name: "add_comment", description: "Add a comment to a task", parameters: { type: "object", properties: { task_id: { type: "string" }, content: { type: "string" } }, required: ["task_id", "content"] } } },
  { type: "function", function: { name: "list_spreadsheets", description: "List all spreadsheets", parameters: { type: "object", properties: {}, required: [] } } },
  { type: "function", function: { name: "create_spreadsheet", description: "Create a spreadsheet with headers and rows of data", parameters: { type: "object", properties: { title: { type: "string" }, headers: { type: "array", items: { type: "string" } }, rows: { type: "array", items: { type: "array", items: { type: "string" } } }, description: { type: "string" } }, required: ["title", "headers"] } } },
  { type: "function", function: { name: "read_spreadsheet", description: "Read the data from a spreadsheet", parameters: { type: "object", properties: { spreadsheet_id: { type: "string" } }, required: ["spreadsheet_id"] } } },
  { type: "function", function: { name: "update_spreadsheet", description: "Update a spreadsheet's title, headers, or rows", parameters: { type: "object", properties: { spreadsheet_id: { type: "string" }, title: { type: "string" }, headers: { type: "array", items: { type: "string" } }, rows: { type: "array", items: { type: "array", items: { type: "string" } } } }, required: ["spreadsheet_id"] } } },
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
2. Pivoting to something concrete you CAN help them with right now — ideally by proactively checking something in their workspace (e.g. overdue tasks, unread messages, upcoming meetings)

Example redirect: "Ha, I wish I could help with restaurant picks! What I can do is check if you have any tasks due today — want me to pull those up so you can plan your day?"

Keep redirects light and helpful, never preachy or robotic. The goal is to make the user feel supported, not rejected.

## Operational rules
- For documents: when listing, show name + link only. Only fetch content (read_doc) if the user explicitly asks to read or view it.
- For messages: when the user says "tell X [message]", use send_message with mention_names to address them directly.
- Always use tools to get real data — never guess or make up task names, IDs, or content.
- After taking an action (create, update, delete, send), confirm it to the user concisely.
- Today's date is ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}.`;

export async function POST(req: NextRequest) {
  try {
    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) return NextResponse.json({ error: "GROQ_API_KEY not set" }, { status: 500 });
    if (!AGENT_API_KEY) return NextResponse.json({ error: "WORKBOX_AGENT_API_KEY not set" }, { status: 500 });

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { messages } = await req.json();
    const groqMessages: Record<string, unknown>[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...messages,
    ];

    for (let round = 0; round < MAX_ROUNDS; round++) {
      let res: Response | null = null;
      for (const model of MODELS) {
        const r = await fetch(GROQ_API, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${groqKey}` },
          body: JSON.stringify({ model, messages: groqMessages, tools: TOOLS, tool_choice: "auto", max_tokens: 1024, temperature: 0.3 }),
        });
        if (r.ok) { res = r; break; }
        if (r.status === 401 || r.status === 403) { res = r; break; }
        await new Promise(resolve => setTimeout(resolve, 800));
      }
      if (!res) return NextResponse.json({ content: "I'm a little busy right now — please try again in a moment." });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const msg = (err as Record<string, { message?: string }>).error?.message ?? `HTTP ${res.status}`;
        return NextResponse.json({ content: `Something went wrong: ${msg}` });
      }

      const data = await res.json();
      const choice = data.choices?.[0];
      const msg = choice?.message;

      if (!msg?.tool_calls?.length) {
        const content = msg?.content;
        if (!content) {
          console.error("[agent] empty Groq response:", JSON.stringify(data));
          return NextResponse.json({ content: "I didn't get a response — please try again." });
        }
        return NextResponse.json({ content });
      }

      groqMessages.push({ role: "assistant", content: msg.content ?? null, tool_calls: msg.tool_calls });

      for (const tc of msg.tool_calls) {
        let args: Record<string, unknown> = {};
        try { args = JSON.parse(tc.function.arguments); } catch { /* ignore */ }
        const result = await executeTool(tc.function.name, args);
        groqMessages.push({ role: "tool", tool_call_id: tc.id, content: result });
      }
    }

    return NextResponse.json({ content: "I've completed the requested actions." });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[agent] error:", msg);
    return NextResponse.json({ error: msg || "Unexpected error" }, { status: 500 });
  }
}
