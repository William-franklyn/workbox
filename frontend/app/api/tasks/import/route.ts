import { NextRequest, NextResponse } from "next/server";
import { requireOrg, assertListInOrg } from "@/lib/auth/guard";
import { emitWebhook } from "@/lib/webhooks";

const STATUS_MAP: Record<string, string> = {
  "todo": "todo", "to do": "todo", "open": "todo", "backlog": "todo", "not started": "todo",
  "in progress": "in_progress", "in_progress": "in_progress", "doing": "in_progress", "working on it": "in_progress",
  "in review": "in_review", "in_review": "in_review", "review": "in_review",
  "done": "done", "complete": "done", "completed": "done", "closed": "done",
};

const PRIORITY_MAP: Record<string, string> = {
  "urgent": "urgent", "critical": "urgent", "highest": "urgent",
  "high": "high",
  "normal": "normal", "medium": "normal", "": "normal",
  "low": "low", "lowest": "low",
};

/** Minimal CSV parser handling quoted fields and escaped quotes. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field); field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some(f => f.trim() !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some(f => f.trim() !== "")) rows.push(row);
  return rows;
}

function normalizeDate(raw: string): string | null {
  if (!raw?.trim()) return null;
  const d = new Date(raw.trim());
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

/**
 * POST { listId, csv } — import tasks from CSV text.
 * Recognized headers (case-insensitive): title/name/task, description/notes,
 * status, priority, due date/due/due_date, tags/labels, assignee email.
 * Works with exports from Asana, Trello, Monday, and plain spreadsheets.
 */
export async function POST(req: NextRequest) {
  const auth = await requireOrg(req);
  if ("error" in auth) return auth.error;
  const { ctx } = auth;
  if (ctx.role === "guest") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { listId, csv } = await req.json() as { listId: string; csv: string };
  if (!listId || !csv?.trim()) return NextResponse.json({ error: "listId and csv are required" }, { status: 400 });

  const listErr = await assertListInOrg(ctx, listId);
  if (listErr) return listErr;

  const rows = parseCsv(csv);
  if (rows.length < 2) return NextResponse.json({ error: "CSV needs a header row and at least one data row" }, { status: 400 });

  const header = rows[0].map(h => h.trim().toLowerCase());
  const col = (names: string[]) => header.findIndex(h => names.includes(h));

  const iTitle = col(["title", "name", "task", "task name", "summary"]);
  if (iTitle === -1) return NextResponse.json({ error: "CSV must include a title/name column" }, { status: 400 });
  const iDesc = col(["description", "notes", "details"]);
  const iStatus = col(["status", "state", "column"]);
  const iPriority = col(["priority"]);
  const iDue = col(["due date", "due", "due_date", "deadline", "due on"]);
  const iTags = col(["tags", "labels", "label"]);
  const iAssignee = col(["assignee", "assignee email", "assigned to", "owner"]);

  const dataRows = rows.slice(1, 1001); // cap at 1000 tasks per import

  // Resolve assignee emails → user ids within the org
  const emails = iAssignee >= 0
    ? [...new Set(dataRows.map(r => r[iAssignee]?.trim().toLowerCase()).filter(e => e?.includes("@")))]
    : [];
  const emailToId = new Map<string, string>();
  if (emails.length) {
    const { data: profiles } = await ctx.svc
      .from("profiles").select("id, email").eq("organization_id", ctx.orgId).in("email", emails);
    for (const p of profiles ?? []) emailToId.set((p.email as string).toLowerCase(), p.id);
  }

  const { count: existingCount } = await ctx.svc
    .from("tasks").select("*", { count: "exact", head: true }).eq("list_id", listId);
  const basePosition = (existingCount ?? 0) * 1000;
  const now = Date.now();

  const taskRows = dataRows.map((r, i) => {
    const rawStatus = (iStatus >= 0 ? r[iStatus] : "").trim().toLowerCase();
    const rawPriority = (iPriority >= 0 ? r[iPriority] : "").trim().toLowerCase();
    const tags = iTags >= 0
      ? r[iTags]?.split(/[;,|]/).map(t => t.trim()).filter(Boolean) ?? []
      : [];
    const assigneeEmail = iAssignee >= 0 ? r[iAssignee]?.trim().toLowerCase() : "";

    return {
      id: `tsk${now}${i}${Math.floor(Math.random() * 1000)}`,
      title: r[iTitle]?.trim() || "(Untitled)",
      description: iDesc >= 0 ? r[iDesc]?.trim() || null : null,
      status: STATUS_MAP[rawStatus] ?? "todo",
      priority: PRIORITY_MAP[rawPriority] ?? "normal",
      due_date: iDue >= 0 ? normalizeDate(r[iDue]) : null,
      tags,
      assignee_id: emailToId.get(assigneeEmail) ?? null,
      list_id: listId,
      position: basePosition + i * 1000,
      created_by: ctx.userId,
    };
  });

  const { data: created, error } = await ctx.svc.from("tasks").insert(taskRows).select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  void emitWebhook(ctx.orgId, "task.created", { imported: created?.length ?? 0, list_id: listId });
  return NextResponse.json({ imported: created?.length ?? 0 });
}
