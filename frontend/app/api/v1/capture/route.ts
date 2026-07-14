import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-key";
import { createServiceClient } from "@/lib/supabase/server";

// Kinds that should auto-get a deadline when none is supplied.
const DEADLINE_KINDS = new Set(["job", "opportunity", "info-session", "info_session", "infosession", "event"]);
const DEFAULT_DAYS = 5;

/**
 * POST /api/v1/capture — turn a web find (a job post, an info session, etc.)
 * into a task in the user's "Opportunities" list. Used by the browser
 * extension. If no deadline is given for an opportunity-like kind, defaults the
 * due date to +5 days so it shows up on the calendar in time to act.
 */
export async function POST(req: NextRequest) {
  const userId = await validateApiKey(req.headers.get("authorization"));
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { kind = "task", title, url, deadline, notes, priority = "normal" } = await req.json();
  if (!title) return NextResponse.json({ error: "title is required" }, { status: 400 });

  const svc = createServiceClient();
  const { data: profile } = await svc.from("profiles").select("organization_id").eq("id", userId).maybeSingle();
  const orgId = profile?.organization_id;
  if (!orgId) return NextResponse.json({ error: "No organization" }, { status: 400 });

  // Resolve (or create) the user's personal "My Workspace" space + "Opportunities" list.
  let { data: space } = await svc.from("spaces").select("id").eq("org_id", orgId).eq("name", "My Workspace").maybeSingle();
  if (!space) {
    const { data: s } = await svc.from("spaces").insert({ id: crypto.randomUUID(), name: "My Workspace", org_id: orgId, icon: "🏠", color: "#7c3aed", position: -1 }).select("id").single();
    space = s;
  }
  if (!space) return NextResponse.json({ error: "Failed to resolve workspace" }, { status: 500 });

  let { data: list } = await svc.from("lists").select("id").eq("space_id", space.id).eq("name", "Opportunities").maybeSingle();
  if (!list) {
    const { count } = await svc.from("lists").select("id", { count: "exact", head: true }).eq("space_id", space.id);
    const { data: l } = await svc.from("lists").insert({ id: `l${Date.now()}`, name: "Opportunities", space_id: space.id, color: "#f59e0b", position: count ?? 0 }).select("id").single();
    list = l;
  }
  if (!list) return NextResponse.json({ error: "Failed to resolve list" }, { status: 500 });

  // Deadline: provided, else +5 days for opportunity-like captures.
  let due: string | null = deadline || null;
  if (!due && DEADLINE_KINDS.has(String(kind))) {
    const d = new Date();
    d.setDate(d.getDate() + DEFAULT_DAYS);
    due = d.toISOString().slice(0, 10);
  }

  const description = [notes, url ? `Link: ${url}` : null].filter(Boolean).join("\n\n") || null;
  const tags = kind && kind !== "task" ? [String(kind)] : [];

  const { count } = await svc.from("tasks").select("id", { count: "exact", head: true }).eq("list_id", list.id);
  const { data, error } = await svc.from("tasks").insert({
    id: crypto.randomUUID(),
    title, list_id: list.id, status: "todo", priority,
    due_date: due, tags, description,
    created_by: userId, org_id: orgId, position: count ?? 0, created_at: new Date().toISOString(),
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ task: data, due_date: due }, { status: 201 });
}
