#!/usr/bin/env node
/**
 * WorkBox MCP Server
 * Connects Claude Code to your WorkBox account via the /api/v1 REST API.
 *
 * Required env vars:
 *   WORKBOX_API_KEY   — generated from WorkBox > Settings > API Keys
 *   WORKBOX_BASE_URL  — e.g. https://workbox-blue.vercel.app
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

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
    method,
    headers: headers(),
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data;
}

// ─── Tool definitions ────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: "workbox_status",
    description: "Check your WorkBox connection and see who you are logged in as.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "workbox_list_spaces",
    description: "List all workspaces and their task lists in WorkBox.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "workbox_list_tasks",
    description: "List tasks from WorkBox. Filter by list, space, status, or due date.",
    inputSchema: {
      type: "object",
      properties: {
        list_id:  { type: "string",  description: "Filter by list ID" },
        space_id: { type: "string",  description: "Filter by space ID (all lists in space)" },
        status:   { type: "string",  enum: ["todo", "in_progress", "in_review", "done"], description: "Filter by status" },
        due:      { type: "string",  description: "Show tasks due on or before this date (YYYY-MM-DD)" },
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
        title:       { type: "string",  description: "Task title" },
        list_id:     { type: "string",  description: "The list to add the task to" },
        status:      { type: "string",  enum: ["todo", "in_progress", "in_review", "done"], description: "Initial status (default: todo)" },
        priority:    { type: "string",  enum: ["urgent", "high", "normal", "low"], description: "Priority (default: normal)" },
        due_date:    { type: "string",  description: "Due date in YYYY-MM-DD format" },
        description: { type: "string",  description: "Optional task description / notes" },
        tags:        { type: "array", items: { type: "string" }, description: "Optional tags" },
      },
      required: ["title", "list_id"],
    },
  },
  {
    name: "workbox_create_plan",
    description: "Create multiple tasks at once — use this to push a full week plan or feature breakdown into WorkBox in one shot.",
    inputSchema: {
      type: "object",
      properties: {
        tasks: {
          type: "array",
          description: "Array of tasks to create",
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
    description: "Update a task — change its status, title, priority, due date, or description.",
    inputSchema: {
      type: "object",
      properties: {
        id:          { type: "string", description: "Task ID" },
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
      properties: {
        id: { type: "string", description: "Task ID to delete" },
      },
      required: ["id"],
    },
  },
  {
    name: "workbox_list_meetings",
    description: "List upcoming meetings from your connected Google Calendar.",
    inputSchema: {
      type: "object",
      properties: {
        days: { type: "number", description: "How many days ahead to look (default 14)" },
      },
      required: [],
    },
  },
  {
    name: "workbox_schedule_meeting",
    description: "Schedule a new Google Calendar meeting with an optional Google Meet link.",
    inputSchema: {
      type: "object",
      properties: {
        title:         { type: "string",  description: "Meeting title" },
        start:         { type: "string",  description: "Start datetime ISO 8601, e.g. 2026-07-10T14:00:00-04:00" },
        end:           { type: "string",  description: "End datetime ISO 8601" },
        attendees:     { type: "array",   items: { type: "string" }, description: "List of attendee email addresses" },
        description:   { type: "string",  description: "Meeting description / agenda" },
        add_meet_link: { type: "boolean", description: "Add a Google Meet link (default true)" },
      },
      required: ["title", "start", "end"],
    },
  },
];

// ─── Tool handlers ───────────────────────────────────────────────────────────

async function callTool(name, args) {
  switch (name) {
    case "workbox_status": {
      const d = await api("GET", "/status");
      return `Connected as ${d.name} (${d.user_id})\nOrg: ${d.org_id ?? "none"}\nAPI version: ${d.api_version}`;
    }

    case "workbox_list_spaces": {
      const d = await api("GET", "/spaces");
      if (!d.spaces?.length) return "No spaces found.";
      return d.spaces.map(s =>
        `📁 ${s.name} (id: ${s.id})\n` +
        (s.lists ?? []).map(l => `   └─ ${l.name} (id: ${l.id})`).join("\n")
      ).join("\n\n");
    }

    case "workbox_list_tasks": {
      const params = new URLSearchParams();
      if (args.list_id)  params.set("list_id",  args.list_id);
      if (args.space_id) params.set("space_id", args.space_id);
      if (args.status)   params.set("status",   args.status);
      if (args.due)      params.set("due",       args.due);
      const d = await api("GET", `/tasks?${params}`);
      if (!d.tasks?.length) return "No tasks found matching the filters.";
      return d.tasks.map(t =>
        `[${t.status}] ${t.title} (id: ${t.id})` +
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
      return `✅ Updated task "${d.task.title}" — status: ${d.task.status}`;
    }

    case "workbox_delete_task": {
      await api("DELETE", `/tasks/${args.id}`, {});
      return `✅ Task ${args.id} deleted.`;
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
      return `✅ Meeting scheduled: "${d.meeting.title}"\n` +
        `   Start: ${d.meeting.start}\n` +
        `   Link: ${d.meeting.meet_link ?? d.meeting.html_link}`;
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// ─── MCP Server bootstrap ────────────────────────────────────────────────────

const server = new Server(
  { name: "workbox", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;
  try {
    const text = await callTool(name, args ?? {});
    return { content: [{ type: "text", text }] };
  } catch (err) {
    return {
      content: [{ type: "text", text: `Error: ${err.message}` }],
      isError: true,
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
