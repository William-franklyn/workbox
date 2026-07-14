import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

const KINDS = ["person", "company", "job", "opportunity", "training", "link"];

async function getCtx() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("organization_id").eq("id", user.id).maybeSingle();
  return { userId: user.id, orgId: profile?.organization_id ?? null };
}

/** GET — the caller's bookmark folders + bookmarks. */
export async function GET() {
  const ctx = await getCtx();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const svc = createServiceClient();
  const [{ data: folders }, { data: items }] = await Promise.all([
    svc.from("bookmark_folders").select("*").eq("user_id", ctx.userId).order("position").order("created_at"),
    svc.from("bookmarks").select("*").eq("user_id", ctx.userId).order("created_at", { ascending: false }),
  ]);
  return NextResponse.json({ folders: folders ?? [], bookmarks: items ?? [] });
}

/** POST { type: "folder" | "bookmark", ... } */
export async function POST(req: NextRequest) {
  const ctx = await getCtx();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const svc = createServiceClient();
  const { type, ...row } = await req.json();

  if (type === "folder") {
    const id = `bf${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
    const { data, error } = await svc.from("bookmark_folders").insert({
      id, user_id: ctx.userId, org_id: ctx.orgId,
      name: (row.name ?? "").trim() || "New folder",
      color: row.color || "#7c3aed",
      position: Number.isFinite(row.position) ? row.position : 0,
    }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data);
  }

  if (type === "bookmark") {
    const id = `bm${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
    const { data, error } = await svc.from("bookmarks").insert({
      id, user_id: ctx.userId, org_id: ctx.orgId,
      folder_id: row.folder_id || null,
      kind: KINDS.includes(row.kind) ? row.kind : "link",
      title: (row.title ?? "").trim() || row.url || "Untitled",
      url: row.url || null,
      subtitle: row.subtitle || null,
      notes: row.notes || null,
      meta: row.meta && typeof row.meta === "object" ? row.meta : {},
    }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data);
  }

  return NextResponse.json({ error: "Invalid type" }, { status: 400 });
}

/** PATCH { id, type, ...fields } — update a folder or bookmark. */
export async function PATCH(req: NextRequest) {
  const ctx = await getCtx();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const svc = createServiceClient();
  const { id, type, ...rest } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if (type === "folder") {
    if (typeof rest.name === "string") patch.name = rest.name.trim();
    if (typeof rest.color === "string") patch.color = rest.color;
    if (Number.isFinite(rest.position)) patch.position = rest.position;
  } else {
    if (typeof rest.title === "string") patch.title = rest.title.trim();
    if (typeof rest.url === "string") patch.url = rest.url;
    if (typeof rest.subtitle === "string") patch.subtitle = rest.subtitle;
    if (typeof rest.notes === "string") patch.notes = rest.notes;
    if ("folder_id" in rest) patch.folder_id = rest.folder_id || null;
    if (KINDS.includes(rest.kind)) patch.kind = rest.kind;
  }

  const table = type === "folder" ? "bookmark_folders" : "bookmarks";
  const { data, error } = await svc.from(table).update(patch).eq("id", id).eq("user_id", ctx.userId).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}

/** DELETE { id, type } */
export async function DELETE(req: NextRequest) {
  const ctx = await getCtx();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const svc = createServiceClient();
  const { id, type } = await req.json();
  const table = type === "folder" ? "bookmark_folders" : "bookmarks";
  await svc.from(table).delete().eq("id", id).eq("user_id", ctx.userId);
  return NextResponse.json({ ok: true });
}
