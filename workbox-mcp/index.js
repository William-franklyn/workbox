#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

const API_KEY  = process.env.WORKBOX_API_KEY;
const BASE_URL = (process.env.WORKBOX_BASE_URL ?? "").replace(/\/$/, "");

if (!API_KEY || !BASE_URL) {
  process.stderr.write("Error: WORKBOX_API_KEY and WORKBOX_BASE_URL must be set.\n");
  process.exit(1);
}

function headers() {
  return { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" };
}

async function api(method, path, body) {
  const res = await fetch(`${BASE_URL}/api/v1${path}`, {
    method, headers: headers(),
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data;
}

// ─── Tool definitions ────────────────────────────────────────────────────────

const TOOLS = [
  // ── Core ──
  {
    name: "workbox_status",
    description: "Check WorkBox connection and see who you are logged in as.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "workbox_get_account",
    description: "Get a full overview of the WorkBox account: profile, spaces, task stats, goals count, docs count, time logged, unread notifications, and active API keys. Use this as the starting point to understand the full state of the workspace.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },

  // ── Spaces & Lists ──
  {
    name: "workbox_list_spaces",
    description: "List all spaces and their task lists in WorkBox.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "workbox_create_space",
    description: "Create a new space (project area) in WorkBox.",
    inputSchema: {
      type: "object",
      properties: {
        name:  { type: "string", description: "Space name" },
        icon:  { type: "string", description: "Emoji icon (default: 🚀)" },
        color: { type: "string", description: "Hex color (default: #7c3aed)" },
      },
      required: ["name"],
    },
  },
  {
    name: "workbox_create_list",
    description: "Create a new task list inside a space.",
    inputSchema: {
      type: "object",
      properties: {
        name:     { type: "string", description: "List name" },
        space_id: { type: "string", description: "The space to create the list in" },
        color:    { type: "string", description: "Hex color (default: #7c3aed)" },
      },
      required: ["name", "space_id"],
    },
  },

  // ── Tasks ──
  {
    name: "workbox_list_tasks",
    description: "List tasks from WorkBox. Filter by list, space, status, or due date.",
    inputSchema: {
      type: "object",
      properties: {
        list_id:  { type: "string", description: "Filter by list ID" },
        space_id: { type: "string", description: "Filter by space ID" },
        status:   { type: "string", enum: ["todo", "in_progress", "in_review", "done"] },
        due:      { type: "string", description: "Tasks due on or before YYYY-MM-DD" },
      },
      required: [],
    },
  },
  {
    name: "workbox_create_task",
    description: "Create a single task in WorkBox.",
    inputSchema: {
      type: "object",
      properties: {
        title:       { type: "string" },
        list_id:     { type: "string" },
        status:      { type: "string", enum: ["todo", "in_progress", "in_review", "done"] },
        priority:    { type: "string", enum: ["urgent", "high", "normal", "low"] },
        due_date:    { type: "string", description: "YYYY-MM-DD" },
        description: { type: "string" },
        tags:        { type: "array", items: { type: "string" } },
      },
      required: ["title", "list_id"],
    },
  },
  {
    name: "workbox_create_plan",
    description: "Create multiple tasks at once — push a full week plan or feature breakdown in one shot.",
    inputSchema: {
      type: "object",
      properties: {
        tasks: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title:       { type: "string" },
              list_id:     { type: "string" },
              status:      { type: "string" },
              priority:    { type: "string" },
              due_date:    { type: "string" },
              description: { type: "string" },
              tags:        { type: "array", items: { type: "string" } },
            },
            required: ["title", "list_id"],
          },
        },
      },
      required: ["tasks"],
    },
  },
  {
    name: "workbox_update_task",
    description: "Update a task's status, title, priority, due date, or description.",
    inputSchema: {
      type: "object",
      properties: {
        id:          { type: "string" },
        title:       { type: "string" },
        status:      { type: "string", enum: ["todo", "in_progress", "in_review", "done"] },
        priority:    { type: "string", enum: ["urgent", "high", "normal", "low"] },
        due_date:    { type: "string" },
        description: { type: "string" },
      },
      required: ["id"],
    },
  },
  {
    name: "workbox_delete_task",
    description: "Delete a task by ID.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
    },
  },

  // ── Subtasks ──
  {
    name: "workbox_list_subtasks",
    description: "List all subtasks for a given task.",
    inputSchema: {
      type: "object",
      properties: { task_id: { type: "string" } },
      required: ["task_id"],
    },
  },
  {
    name: "workbox_add_subtask",
    description: "Add a subtask to an existing task.",
    inputSchema: {
      type: "object",
      properties: {
        task_id: { type: "string" },
        title:   { type: "string" },
      },
      required: ["task_id", "title"],
    },
  },
  {
    name: "workbox_complete_subtask",
    description: "Mark a subtask as complete or incomplete.",
    inputSchema: {
      type: "object",
      properties: {
        id:        { type: "string", description: "Subtask ID" },
        completed: { type: "boolean" },
      },
      required: ["id", "completed"],
    },
  },

  // ── Comments ──
  {
    name: "workbox_list_comments",
    description: "Get all comments on a task.",
    inputSchema: {
      type: "object",
      properties: { task_id: { type: "string" } },
      required: ["task_id"],
    },
  },
  {
    name: "workbox_add_comment",
    description: "Add a comment to a task.",
    inputSchema: {
      type: "object",
      properties: {
        task_id: { type: "string" },
        content: { type: "string" },
      },
      required: ["task_id", "content"],
    },
  },

  // ── Goals ──
  {
    name: "workbox_list_goals",
    description: "List all goals/OKRs with their key results and progress percentage.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "workbox_create_goal",
    description: "Create a new goal with optional key results.",
    inputSchema: {
      type: "object",
      properties: {
        title:       { type: "string" },
        description: { type: "string" },
        due_date:    { type: "string", description: "YYYY-MM-DD" },
        key_results: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title:        { type: "string" },
              target_value: { type: "number" },
              unit:         { type: "string", description: "e.g. %, tasks, users" },
            },
            required: ["title"],
          },
        },
      },
      required: ["title"],
    },
  },
  {
    name: "workbox_update_goal_progress",
    description: "Update the current value of a key result to track goal progress.",
    inputSchema: {
      type: "object",
      properties: {
        goal_id:       { type: "string" },
        kr_id:         { type: "string", description: "Key result ID" },
        current_value: { type: "number" },
      },
      required: ["goal_id", "kr_id", "current_value"],
    },
  },

  // ── Docs ──
  {
    name: "workbox_list_docs",
    description: "List all documents in the workspace.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "workbox_create_doc",
    description: "Create a new document in the workspace.",
    inputSchema: {
      type: "object",
      properties: {
        title:   { type: "string" },
        content: { type: "string", description: "Plain text content for the document" },
      },
      required: ["title"],
    },
  },

  // ── Members ──
  {
    name: "workbox_list_members",
    description: "List all members in the workspace with their roles.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "workbox_invite_member",
    description: "Invite a new member to the workspace by email.",
    inputSchema: {
      type: "object",
      properties: {
        email: { type: "string" },
        role:  { type: "string", enum: ["admin", "member"], description: "Default: member" },
      },
      required: ["email"],
    },
  },

  // ── Notifications ──
  {
    name: "workbox_get_notifications",
    description: "Get recent notifications and unread count.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "workbox_mark_notifications_read",
    description: "Mark notifications as read (one or all).",
    inputSchema: {
      type: "object",
      properties: {
        id:            { type: "string", description: "Specific notification ID (omit for all)" },
        mark_all_read: { type: "boolean", description: "Set true to mark all as read" },
      },
      required: [],
    },
  },

  // ── Time tracking ──
  {
    name: "workbox_get_time_summary",
    description: "Get a summary of time logged across all tasks.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "workbox_log_time",
    description: "Log time spent on a task.",
    inputSchema: {
      type: "object",
      properties: {
        task_id:          { type: "string" },
        duration_minutes: { type: "number" },
        note:             { type: "string" },
      },
      required: ["task_id", "duration_minutes"],
    },
  },

  // ── Meetings ──
  {
    name: "workbox_list_meetings",
    description: "List upcoming meetings from Google Calendar.",
    inputSchema: {
      type: "object",
      properties: { days: { type: "number", description: "Days ahead to look (default 14)" } },
      required: [],
    },
  },
  {
    name: "workbox_schedule_meeting",
    description: "Schedule a new Google Calendar meeting with an optional Google Meet link.",
    inputSchema: {
      type: "object",
      properties: {
        title:         { type: "string" },
        start:         { type: "string", description: "ISO 8601, e.g. 2026-07-10T14:00:00-04:00" },
        end:           { type: "string", description: "ISO 8601" },
        attendees:     { type: "array", items: { type: "string" }, description: "Email addresses" },
        description:   { type: "string" },
        add_meet_link: { type: "boolean", description: "Add Google Meet link (default true)" },
      },
      required: ["title", "start", "end"],
    },
  },
];

// ─── Tool handlers ────────────────────────────────────────────────────────────

async function callTool(name, args) {
  switch (name) {

    case "workbox_status": {
      const d = await api("GET", "/status");
      return `Connected as ${d.name} (${d.user_id})\nAPI version: ${d.api_version}`;
    }

    case "workbox_get_account": {
      const d = await api("GET", "/account");
      return [
        `👤 ${d.user.name} (${d.user.email}) — ${d.user.role}`,
        `🏢 Org ID: ${d.user.organization_id}`,
        `📅 Member since: ${new Date(d.user.member_since).toLocaleDateString()}`,
        ``,
        `📁 Spaces: ${d.workspace.spaces_count}  |  Lists: ${d.workspace.lists_count}`,
        d.workspace.spaces.map(s => `   • ${s.icon} ${s.name} (id: ${s.id})`).join("\n"),
        ``,
        `✅ Tasks: ${d.tasks.total} total`,
        `   Todo: ${d.tasks.todo}  |  In Progress: ${d.tasks.in_progress}  |  In Review: ${d.tasks.in_review}  |  Done: ${d.tasks.done}`,
        ``,
        `🎯 Goals: ${d.goals_count}`,
        `📄 Docs: ${d.docs_count}`,
        `🔔 Unread notifications: ${d.unread_notifications}`,
        `⏱  Time logged: ${d.time_logged_hours}h`,
        `🔑 Active API keys: ${d.active_api_keys}`,
      ].join("\n");
    }

    case "workbox_list_spaces": {
      const d = await api("GET", "/spaces");
      if (!d.spaces?.length) return "No spaces found.";
      return d.spaces.map(s =>
        `📁 ${s.name} (id: ${s.id})\n` +
        (s.lists ?? []).map(l => `   └─ ${l.name} (id: ${l.id})`).join("\n")
      ).join("\n\n");
    }

    case "workbox_create_space": {
      const d = await api("POST", "/spaces", args);
      return `✅ Created space "${d.space.name}" (id: ${d.space.id})`;
    }

    case "workbox_create_list": {
      const d = await api("POST", "/lists", args);
      return `✅ Created list "${d.list.name}" (id: ${d.list.id}) in space ${args.space_id}`;
    }

    case "workbox_list_tasks": {
      const params = new URLSearchParams();
      if (args.list_id)  params.set("list_id",  args.list_id);
      if (args.space_id) params.set("space_id", args.space_id);
      if (args.status)   params.set("status",   args.status);
      if (args.due)      params.set("due",       args.due);
      const d = await api("GET", `/tasks?${params}`);
      if (!d.tasks?.length) return "No tasks found.";
      return d.tasks.map(t =>
        `[${t.status}] ${t.title} (id: ${t.id}, list_id: ${t.list_id})` +
        (t.due_date ? ` — due ${t.due_date}` : "") +
        (t.priority !== "normal" ? ` [${t.priority}]` : "")
      ).join("\n");
    }

    case "workbox_create_task": {
      const d = await api("POST", "/tasks", args);
      return `✅ Created task "${d.task.title}" (id: ${d.task.id})`;
    }

    case "workbox_create_plan": {
      const d = await api("POST", "/tasks/batch", { tasks: args.tasks });
      return `✅ Created ${d.created} task${d.created !== 1 ? "s" : ""}:\n` +
        (d.tasks ?? []).map(t => `  • ${t.title} (id: ${t.id})`).join("\n");
    }

    case "workbox_update_task": {
      const { id, ...patch } = args;
      const d = await api("PATCH", `/tasks/${id}`, patch);
      return `✅ Updated "${d.task.title}" — status: ${d.task.status}`;
    }

    case "workbox_delete_task": {
      await api("DELETE", `/tasks/${args.id}`, {});
      return `✅ Task ${args.id} deleted.`;
    }

    case "workbox_list_subtasks": {
      const d = await api("GET", `/subtasks?task_id=${args.task_id}`);
      if (!d.subtasks?.length) return "No subtasks found.";
      return d.subtasks.map(s =>
        `[${s.completed ? "✓" : " "}] ${s.title} (id: ${s.id})`
      ).join("\n");
    }

    case "workbox_add_subtask": {
      const d = await api("POST", "/subtasks", args);
      return `✅ Added subtask "${d.subtask.title}" (id: ${d.subtask.id})`;
    }

    case "workbox_complete_subtask": {
      const d = await api("PATCH", "/subtasks", args);
      return `✅ Subtask "${d.subtask.title}" marked ${d.subtask.completed ? "complete" : "incomplete"}`;
    }

    case "workbox_list_comments": {
      const d = await api("GET", `/comments?task_id=${args.task_id}`);
      if (!d.comments?.length) return "No comments yet.";
      return d.comments.map(c =>
        `[${new Date(c.created_at).toLocaleString()}] ${c.content}`
      ).join("\n\n");
    }

    case "workbox_add_comment": {
      const d = await api("POST", "/comments", args);
      return `✅ Comment added (id: ${d.comment.id})`;
    }

    case "workbox_list_goals": {
      const d = await api("GET", "/goals");
      if (!d.goals?.length) return "No goals found.";
      return d.goals.map(g => {
        const krs = (g.key_results ?? []).map(kr =>
          `     • ${kr.title}: ${kr.current_value}/${kr.target_value}${kr.unit}`
        ).join("\n");
        return `🎯 ${g.title} — ${g.progress_pct}% complete (id: ${g.id})` +
          (g.due_date ? `\n   Due: ${g.due_date}` : "") +
          (krs ? `\n${krs}` : "");
      }).join("\n\n");
    }

    case "workbox_create_goal": {
      const d = await api("POST", "/goals", args);
      return `✅ Created goal "${d.goal.title}" (id: ${d.goal.id})\n` +
        (d.goal.key_results?.length ? `   Key results: ${d.goal.key_results.length}` : "");
    }

    case "workbox_update_goal_progress": {
      const d = await api("PATCH", `/goals/${args.goal_id}`, {
        kr_id: args.kr_id, current_value: args.current_value,
      });
      return `✅ Key result updated: ${d.key_result.current_value}/${d.key_result.target_value}${d.key_result.unit}`;
    }

    case "workbox_list_docs": {
      const d = await api("GET", "/docs");
      if (!d.docs?.length) return "No documents found.";
      return d.docs.map(doc =>
        `📄 ${doc.title} (id: ${doc.id}) — updated ${new Date(doc.updated_at).toLocaleDateString()}`
      ).join("\n");
    }

    case "workbox_create_doc": {
      const d = await api("POST", "/docs", args);
      return `✅ Created doc "${d.doc.title}" (id: ${d.doc.id})`;
    }

    case "workbox_list_members": {
      const d = await api("GET", "/members");
      if (!d.members?.length) return "No members found.";
      return d.members.map(m =>
        `👤 ${m.full_name ?? m.email} — ${m.role} (id: ${m.id})\n   ${m.email}`
      ).join("\n\n");
    }

    case "workbox_invite_member": {
      const d = await api("POST", "/members", args);
      return `✅ Invite sent to ${d.email}`;
    }

    case "workbox_get_notifications": {
      const d = await api("GET", "/notifications");
      if (!d.notifications?.length) return "No notifications.";
      const lines = [`🔔 ${d.unread_count} unread\n`];
      d.notifications.slice(0, 10).forEach(n => {
        lines.push(`[${n.read ? "read" : "NEW"}] ${n.title}${n.body ? ` — ${n.body}` : ""}`);
      });
      return lines.join("\n");
    }

    case "workbox_mark_notifications_read": {
      await api("PATCH", "/notifications", args);
      return "✅ Notifications marked as read.";
    }

    case "workbox_get_time_summary": {
      const d = await api("GET", "/time-logs");
      return `⏱ Total time logged: ${d.total_hours}h (${d.total_minutes} minutes)\n` +
        (d.time_logs?.length
          ? `Recent entries:\n` + d.time_logs.slice(0, 5).map(t =>
              `  • ${t.duration_minutes}min on task ${t.task_id}${t.note ? ` — ${t.note}` : ""}`
            ).join("\n")
          : "No time logs yet.");
    }

    case "workbox_log_time": {
      const d = await api("POST", "/time-logs", args);
      return `✅ Logged ${args.duration_minutes} minutes on task ${args.task_id}`;
    }

    case "workbox_list_meetings": {
      const days = args.days ?? 14;
      const d = await api("GET", `/meetings?days=${days}`);
      if (!d.meetings?.length) return `No meetings in the next ${days} days.`;
      return d.meetings.map(m => {
        const start = new Date(m.start).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
        return `📅 ${m.title}\n   ${start}\n   ${m.meet_link ?? m.html_link}` +
          (m.attendees?.length ? `\n   👥 ${m.attendees.join(", ")}` : "");
      }).join("\n\n");
    }

    case "workbox_schedule_meeting": {
      const d = await api("POST", "/meetings", args);
      return `✅ Meeting scheduled: "${d.meeting.title}"\n   Start: ${d.meeting.start}\n   Link: ${d.meeting.meet_link ?? d.meeting.html_link}`;
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// ─── MCP Server bootstrap ─────────────────────────────────────────────────────

const server = new Server(
  { name: "workbox", version: "2.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;
  try {
    const text = await callTool(name, args ?? {});
    return { content: [{ type: "text", text }] };
  } catch (err) {
    return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
