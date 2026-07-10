import { createServiceClient } from "@/lib/supabase/server";
import { getValidToken, listEvents, createCalendarEvent, getJoinLink } from "@/lib/google/calendar";
import { searchChunks, reindexSource, removeSource } from "@/lib/embeddings";
import { generateOutreachEmail } from "@/lib/outreach/draft";
import { buildChartConfig, chartImageUrl, type ChartKind as VizKind } from "@/lib/viz/quickchart";

function round(n: number): number { return Math.round(n * 100) / 100; }

/** Find a spreadsheet in the org by fuzzy name match (e.g. "sales.csv" -> "Sales"). */
async function findSheet(
  supabase: ReturnType<typeof createServiceClient>,
  orgId: string | null,
  name: string,
): Promise<Record<string, unknown> | null> {
  const clean = (name ?? "").replace(/\.(csv|xlsx?|sheet)$/i, "").trim();
  let q = supabase.from("spreadsheets").select("id, name, col_headers, row_data");
  if (orgId) q = q.eq("organization_id", orgId);
  const { data } = await q;
  if (!data?.length) return null;
  const exact = data.find(s => s.name?.toLowerCase() === clean.toLowerCase());
  if (exact) return exact;
  return data.find(s => s.name?.toLowerCase().includes(clean.toLowerCase()) || clean.toLowerCase().includes(s.name?.toLowerCase() ?? "")) ?? null;
}

export const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://workbox-blue.vercel.app";

export function blocksToText(blocks: unknown[]): string {
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

export async function getAllowedListIds(supabase: ReturnType<typeof createServiceClient>, orgId: string | null): Promise<string[]> {
  const q = supabase.from("spaces").select("id");
  const { data: spaces } = orgId ? await q.eq("org_id", orgId) : await q;
  const spaceIds = (spaces ?? []).map((s: Record<string, string>) => s.id);
  if (!spaceIds.length) return [];
  const { data: lists } = await supabase.from("lists").select("id").in("space_id", spaceIds);
  return (lists ?? []).map((l: Record<string, string>) => l.id);
}

export async function executeTool(
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
      let q = supabase.from("tasks").select("id, title, status, priority, due_date, assignee_id").in("list_id", ids).order("position");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (args.status) q = (q as any).eq("status", args.status as string);
      const { data } = await q;
      if (!data?.length) return "No tasks found.";
      return (data as Record<string, string>[]).map(t =>
        `• [${t.id}] ${t.title} — ${t.status}${t.priority ? ` (${t.priority})` : ""}${t.due_date ? ` · due ${t.due_date}` : ""}${t.assignee_id ? ` · assignee:${t.assignee_id}` : ""}`
      ).join("\n");
    }

    case "create_task": {
      const { title, list_id, status = "todo", priority = "normal", due_date, description, assignee_id } = args as Record<string, string>;
      const { data, error } = await supabase.from("tasks").insert({
        id: crypto.randomUUID(), title, list_id, status, priority,
        due_date: due_date || null, description: description || null,
        assignee_id: assignee_id || null,
        created_by: userId, org_id: orgId, position: 0,
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
      void reindexSource("doc", docId, orgId, title, content as string);
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
      {
        const { data: saved } = await supabase.from("docs").select("title, blocks").eq("id", doc_id).maybeSingle();
        if (saved) void reindexSource("doc", doc_id, orgId, (saved as Record<string, string>).title, blocksToText((saved as Record<string, unknown>).blocks as unknown[] ?? []));
      }
      return "Document updated.";
    }

    case "delete_doc": {
      await supabase.from("docs").delete().eq("id", args.doc_id as string);
      void removeSource("doc", args.doc_id as string);
      return "Document deleted.";
    }

    case "search_knowledge": {
      if (!orgId) return "No organization context.";
      const matches = await searchChunks(args.query as string, orgId, 5);
      if (matches === null) return "Semantic search isn't available right now.";
      if (!matches.length) return "Nothing relevant found in documents or the knowledge base.";
      return matches.map(m =>
        `[${m.source_type === "kb" ? "Knowledge Base" : "Document"}: ${m.title}] (${BASE_URL}/${m.source_type === "kb" ? "knowledge" : "docs/" + m.source_id})\n${m.content.slice(0, 500)}`
      ).join("\n\n");
    }

    case "draft_outreach_email": {
      const { contact_id, contact_name, intent, tone } = args as Record<string, string>;
      if (!intent) return "Tell me what the email should say or offer.";

      // Resolve the contact by id or by name within the org
      let cq = supabase.from("crm_contacts").select("first_name, last_name, job_title, org_id, company:crm_companies(name)");
      if (contact_id) cq = cq.eq("id", contact_id);
      else if (contact_name) {
        const [fn, ...rest] = contact_name.trim().split(" ");
        cq = cq.ilike("first_name", `%${fn}%`);
        if (rest.length) cq = cq.ilike("last_name", `%${rest.join(" ")}%`);
      } else return "Give me the contact's name or id.";
      const { data: contact } = await cq.maybeSingle();
      if (!contact || (orgId && contact.org_id !== orgId)) return "I couldn't find that contact in your CRM.";

      const { data: org } = orgId ? await supabase.from("organizations").select("name").eq("id", orgId).maybeSingle() : { data: null };
      try {
        const draft = await generateOutreachEmail({
          orgId,
          sender: { name: senderName, company: (org as Record<string, string> | null)?.name },
          contact: {
            first_name: contact.first_name, last_name: contact.last_name, job_title: contact.job_title,
            company: (contact.company as { name?: string } | null)?.name,
          },
          intent, tone,
        });
        return `Subject: ${draft.subject}\n\n${draft.body}\n\n(${draft.word_count} words — say "send it" once outreach sending is set up, or copy it out.)`;
      } catch {
        return "I couldn't draft that email right now.";
      }
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
      // Only the creator, invited participants, or admins may move progress
      const { data: goal } = await supabase.from("goals").select("created_by").eq("id", goal_id as string).maybeSingle();
      if (goal && goal.created_by !== userId) {
        const [{ data: member }, { data: prof }] = await Promise.all([
          supabase.from("goal_members").select("user_id").eq("goal_id", goal_id as string).eq("user_id", userId).maybeSingle(),
          supabase.from("profiles").select("role").eq("id", userId).maybeSingle(),
        ]);
        const role = (prof as Record<string, string> | null)?.role;
        if (!member && role !== "admin" && role !== "owner") {
          return "You're not a participant of this goal. Ask the goal creator to invite you, then you can update progress.";
        }
      }
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
        const iso = e.start.dateTime ?? e.start.date ?? "";
        let when = iso;
        try {
          when = new Date(iso).toLocaleString("en-US", {
            weekday: "short", month: "short", day: "numeric",
            ...(e.start.dateTime ? { hour: "numeric", minute: "2-digit" } : {}),
            timeZone: e.start.timeZone ?? undefined,
          });
        } catch { /* keep raw ISO if timezone id is unknown */ }
        const link = getJoinLink(e);
        return `• ${e.summary} — ${when}${link ? `\n  Join: ${link}` : ""}`;
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
      const q = supabase.from("spreadsheets").select("id, name, row_data, updated_at")
        .order("updated_at", { ascending: false });
      const { data } = orgId ? await q.eq("organization_id", orgId) : await q;
      if (!data?.length) return "No spreadsheets found.";
      return (data as Record<string, unknown>[]).map(d =>
        `• ${d.name} (${(d.row_data as unknown[] ?? []).length} rows) — ${BASE_URL}/spreadsheet/${d.id} [ID: ${d.id}]`
      ).join("\n");
    }

    case "create_spreadsheet": {
      const { title, headers = [], rows = [] } = args as Record<string, unknown>;
      const sheetId = crypto.randomUUID();
      const { error } = await supabase.from("spreadsheets").insert({
        id: sheetId,
        name: (title as string) || "Untitled Spreadsheet",
        organization_id: orgId,
        created_by: userId,
        col_headers: (headers as string[]).length ? headers : ["A", "B", "C", "D", "E"],
        row_data: rows,
      });
      if (error) return `Error: ${error.message}`;
      return `Created spreadsheet "${title}" — ${BASE_URL}/spreadsheet/${sheetId} [ID: ${sheetId}]`;
    }

    case "read_spreadsheet": {
      const { data } = await supabase.from("spreadsheets").select("name, col_headers, row_data").eq("id", args.spreadsheet_id as string).maybeSingle();
      if (!data) return "Spreadsheet not found.";
      const d = data as Record<string, unknown>;
      const header = (d.col_headers as string[] ?? []).join(" | ");
      const rowLines = (d.row_data as string[][] ?? []).map(r => r.join(" | ")).join("\n");
      return `"${d.name}"\n${header}\n${rowLines || "(empty)"}`;
    }

    case "analyze_data": {
      const sheet = await findSheet(supabase, orgId, args.name as string);
      if (!sheet) return `I couldn't find a spreadsheet matching "${args.name}". Ask me to "list spreadsheets" to see what's available.`;
      const headers = (sheet.col_headers as string[]) ?? [];
      const rows = (sheet.row_data as string[][]) ?? [];
      if (!rows.length) return `"${sheet.name}" has no data rows.`;

      const lines = [`Analysis of "${sheet.name}" — ${rows.length} rows, ${headers.length} columns.`];
      headers.forEach((h, c) => {
        const nums = rows.map(r => Number(r[c])).filter(n => !isNaN(n));
        if (nums.length >= rows.length * 0.6 && nums.length) {
          const total = nums.reduce((s, n) => s + n, 0);
          lines.push(`- ${h || "Column " + (c + 1)}: total ${round(total)}, avg ${round(total / nums.length)}, min ${round(Math.min(...nums))}, max ${round(Math.max(...nums))}`);
        } else {
          const uniq = new Set(rows.map(r => r[c]).filter(Boolean));
          lines.push(`- ${h || "Column " + (c + 1)}: ${uniq.size} distinct values (text)`);
        }
      });
      return lines.join("\n") + `\n\nWant a chart? Ask me to visualize a column.`;
    }

    case "visualize_data": {
      const sheet = await findSheet(supabase, orgId, args.name as string);
      if (!sheet) return `I couldn't find a spreadsheet matching "${args.name}".`;
      const headers = (sheet.col_headers as string[]) ?? [];
      const rows = (sheet.row_data as string[][]) ?? [];
      if (!rows.length) return `"${sheet.name}" has no data to chart.`;

      const colIndex = (name: string | undefined, fallback: number) => {
        if (!name) return fallback;
        const i = headers.findIndex(h => h?.toLowerCase().includes(name.toLowerCase()));
        return i >= 0 ? i : fallback;
      };
      const numericCols = headers.map((_, c) => c).filter(c => {
        const nums = rows.map(r => Number(r[c])).filter(n => !isNaN(n));
        return nums.length >= rows.length * 0.6 && nums.length > 0;
      });
      const labelCol = colIndex(args.label_column as string, 0);
      const valueCol = colIndex(args.value_column as string, numericCols.find(c => c !== labelCol) ?? 1);
      const kind = (["bar", "line", "doughnut", "polarArea", "pie"].includes(args.chart_type as string) ? args.chart_type : "bar") as VizKind;

      // Aggregate values per label (sum) so repeated categories combine
      const agg: Record<string, number> = {};
      for (const r of rows) {
        const label = String(r[labelCol] ?? "");
        if (!label) continue;
        agg[label] = (agg[label] ?? 0) + (Number(r[valueCol]) || 0);
      }
      const labels = Object.keys(agg).slice(0, 20);
      const values = labels.map(l => agg[l]);
      if (!labels.length) return "No chartable data in that selection.";

      const config = buildChartConfig({ kind, labels, values, title: `${headers[valueCol] ?? "Value"} by ${headers[labelCol] ?? "category"}`, datasetLabel: headers[valueCol] ?? "Value" });
      const url = await chartImageUrl(config);
      const total = values.reduce((s, v) => s + v, 0);
      const topLabel = labels[values.indexOf(Math.max(...values))];
      const summary = `${headers[valueCol] ?? "Value"} by ${headers[labelCol] ?? "category"} — total ${round(total)}, highest is ${topLabel} (${round(Math.max(...values))}).`;
      if (!url) return summary + " (Chart image couldn't be generated right now.)";
      // The WhatsApp/agent layer detects this URL and sends it as an image.
      return `${summary}\n\nCHART_IMAGE: ${url}`;
    }

    case "create_form": {
      const { name, description, fields } = args as { name: string; description?: string; fields: Record<string, unknown>[] };
      const { data, error } = await supabase.from("forms").insert({
        id: `form${Date.now()}`,
        name: name ?? "Untitled Form",
        description: description ?? null,
        org_id: orgId,
        created_by: userId,
        fields: fields ?? [],
        default_status: "todo",
        default_priority: "normal",
      }).select("id, name").single();
      if (error) return `Error: ${error.message}`;
      const fid = (data as Record<string, string>).id;
      return `Created form "${(data as Record<string, string>).name}"\nShare link: ${BASE_URL}/f/${fid}\nManage & customize: ${BASE_URL}/forms`;
    }

    case "list_forms": {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let fq = supabase.from("forms").select("id, name, description, created_at").order("created_at", { ascending: false }) as any;
      if (orgId) fq = fq.eq("org_id", orgId);
      const { data: forms } = await fq;
      if (!forms?.length) return "No forms found.";
      return (forms as Record<string, string>[]).map(f =>
        `• [${f.id}] ${f.name}${f.description ? ` — ${f.description}` : ""}\n  Link: ${BASE_URL}/f/${f.id}`
      ).join("\n");
    }

    case "update_spreadsheet": {
      const { spreadsheet_id, rows, headers, title } = args as Record<string, unknown>;
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (headers) patch.col_headers = headers;
      if (rows) patch.row_data = rows;
      if (title) patch.name = title;
      // Agent edits bypass the Univer editor — drop the stale snapshot so the
      // editor rebuilds from the fresh values on next open (formatting resets).
      if (headers || rows) patch.workbook = null;
      const { error } = await supabase.from("spreadsheets").update(patch).eq("id", spreadsheet_id as string);
      if (error) return `Error: ${error.message}`;
      return "Spreadsheet updated.";
    }

    default:
      return `Unknown tool: ${name}`;
  }
}

export const TOOLS = [
  { name: "list_tasks", description: "List all tasks, optionally filtered by list_id or status (todo/in_progress/in_review/done)", input_schema: { type: "object", properties: { list_id: { type: "string" }, status: { type: "string" } }, required: [] } },
  { name: "create_task", description: "Create a new task in a list, optionally assigned to a member", input_schema: { type: "object", properties: { title: { type: "string" }, list_id: { type: "string" }, status: { type: "string", description: "todo (default), in_progress, in_review, done" }, priority: { type: "string", description: "urgent, high, normal (default), low" }, due_date: { type: "string", description: "ISO date e.g. 2026-07-01" }, description: { type: "string" }, assignee_id: { type: "string", description: "User ID of the member to assign this task to. Use list_members first to find the right ID." } }, required: ["title", "list_id"] } },
  { name: "update_task", description: "Update a task's title, status, priority, due_date, description, or assignee", input_schema: { type: "object", properties: { task_id: { type: "string" }, title: { type: "string" }, status: { type: "string" }, priority: { type: "string" }, due_date: { type: "string" }, description: { type: "string" }, assignee_id: { type: "string", description: "User ID to assign the task to. Use list_members first to find the right ID." } }, required: ["task_id"] } },
  { name: "delete_task", description: "Delete a task by ID", input_schema: { type: "object", properties: { task_id: { type: "string" } }, required: ["task_id"] } },
  { name: "list_spaces", description: "List all spaces and their lists (with IDs)", input_schema: { type: "object", properties: {}, required: [] } },
  { name: "create_space", description: "Create a new space", input_schema: { type: "object", properties: { name: { type: "string" }, icon: { type: "string" }, color: { type: "string" } }, required: ["name"] } },
  { name: "create_list", description: "Create a new list inside a space", input_schema: { type: "object", properties: { name: { type: "string" }, space_id: { type: "string" } }, required: ["name", "space_id"] } },
  { name: "list_docs", description: "List all documents (title and portal link only)", input_schema: { type: "object", properties: {}, required: [] } },
  { name: "search_knowledge", description: "Semantic search across the organization's documents and knowledge base. Use this FIRST when asked about company information, policies, decisions, or anything that may be written down somewhere.", input_schema: { type: "object", properties: { query: { type: "string", description: "What to look for, phrased as a natural question or topic" } }, required: ["query"] } },
  { name: "draft_outreach_email", description: "Draft a personalized outreach email to a CRM contact, in the user's own voice. Use when the user asks to write/draft an email to a contact.", input_schema: { type: "object", properties: { contact_id: { type: "string", description: "CRM contact id if known" }, contact_name: { type: "string", description: "Contact's name to look up if id unknown" }, intent: { type: "string", description: "What the email should say or offer" }, tone: { type: "string", description: "Optional tone, e.g. warm, concise, formal" } }, required: ["intent"] } },
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
  { name: "analyze_data", description: "Analyze a spreadsheet/data file by name (e.g. 'sales.csv' or 'Sales') and return a summary: row/column counts and per-column stats (total, average, min, max). Use when the user asks to analyze or summarize a file or dataset.", input_schema: { type: "object", properties: { name: { type: "string", description: "The spreadsheet/file name to analyze" } }, required: ["name"] } },
  { name: "visualize_data", description: "Create a chart image from a spreadsheet by name and return a shareable image URL (works over WhatsApp). Use when the user asks to visualize, chart, graph, or 'show me' data, or wants a screenshot of a graph.", input_schema: { type: "object", properties: { name: { type: "string", description: "Spreadsheet/file name" }, label_column: { type: "string", description: "Column to use for labels (category names)" }, value_column: { type: "string", description: "Numeric column to chart" }, chart_type: { type: "string", description: "bar (default), line, doughnut, polarArea, or pie" } }, required: ["name"] } },
  { name: "update_spreadsheet", description: "Update a spreadsheet's title, headers, or rows", input_schema: { type: "object", properties: { spreadsheet_id: { type: "string" }, title: { type: "string" }, headers: { type: "array", items: { type: "string" } }, rows: { type: "array", items: { type: "array", items: { type: "string" } } } }, required: ["spreadsheet_id"] } },
  {
    name: "create_form",
    description: "Create a form or survey with custom fields. Use when the user asks to build a form, intake form, survey, questionnaire, registration, feedback form, etc. You generate the fields — no need to ask the user for each one.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Form name" },
        description: { type: "string", description: "What the form is for" },
        fields: {
          type: "array",
          description: "Form fields. Generate 5-10 sensible fields based on the form's purpose.",
          items: {
            type: "object",
            properties: {
              id: { type: "string", description: "Unique ID like f1, f2, f3" },
              type: { type: "string", description: "text | textarea | email | phone | number | date | select | radio | checkbox | rating | heading" },
              label: { type: "string" },
              placeholder: { type: "string", description: "Helpful hint text (skip for heading, rating, checkbox)" },
              required: { type: "boolean" },
              options: { type: "array", items: { type: "string" }, description: "Choices for select or radio fields" },
              maps_to: { type: "string", description: "title or description — tag the single most relevant field, null for others" },
            },
            required: ["id", "type", "label"],
          },
        },
      },
      required: ["name", "fields"],
    },
  },
  { name: "list_forms", description: "List all forms in the workspace with their share links", input_schema: { type: "object", properties: {}, required: [] } },
];

export const SYSTEM_PROMPT = `You are WorkBox Agent — the AI brain built into WorkBox, a project management and productivity platform. You have direct, real-time access to the entire workspace through tools.

You can:
- Read and write tasks (create, update, delete, filter by status/list), including assigning tasks to team members
- Manage spaces and lists
- Read, create, update, and delete documents and spreadsheets
- Check and send team chat messages (you can @mention teammates by name)
- View and create goals with key results, track progress
- Check notifications and mark them read
- List and schedule meetings via Google Calendar
- Log time and view time summaries
- Manage subtasks and comments on tasks
- Create forms and surveys (intake forms, feedback forms, registrations, etc.) and list existing forms

## Topic focus — IMPORTANT
Your purpose is to help users be more productive at work using WorkBox. You only help with:
- Work, tasks, projects, and productivity
- Anything inside the user's WorkBox workspace (tasks, docs, goals, meetings, teammates, messages)
- General professional topics: time management, prioritisation, team communication, goal setting

If a user asks about anything outside this scope — food, entertainment, personal lifestyle, general knowledge, trivia, coding unrelated to their work, creative writing for fun, etc. — do NOT answer it. Instead, warmly redirect them by:
1. Briefly acknowledging what they asked (one sentence, no judgement)
2. Pivoting to something concrete you CAN help them with right now

Keep redirects light and helpful, never preachy or robotic.

## Be fast — act, don't interrogate
Users are busy. Act immediately using smart defaults. When info is missing, assume the most reasonable value and proceed. Confirm what you did in one line — never ask a list of questions.

**Meeting defaults** (never ask for these — just use them):
- Duration: 1 hour unless context implies otherwise
- Title: derive from context ("Check-in", "Catch-up", "Sync", etc.)
- Google Meet link: always include
- Description: omit unless the user provided agenda details
- "tomorrow at 6pm" → start 18:00, end 19:00. Done.

**Task defaults:** status = todo, priority = normal, no due date unless mentioned.

**Assigning tasks:** When a user asks you to assign a task to someone by name, ALWAYS call list_members first to look up their user ID. Then pass that ID as assignee_id to create_task or update_task. Never guess a user ID.

**The one-question rule:** Only ask if the missing info makes the action literally impossible (no name, no email, no context at all). Maximum one question, never a list.

## Operational rules
- For documents: when listing, show name + link only. Only fetch content (read_doc) if the user explicitly asks to read or view it.
- For messages: when the user says "tell X [message]", use send_message with mention_names to address them directly.
- Always use tools to get real data — never guess or make up task names, IDs, or content.
- After taking an action, confirm in one short sentence.
- Today's date is ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}. Use this to resolve "tomorrow", "next Monday", etc.`;
