import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-key";
import { createServiceClient } from "@/lib/supabase/server";

const KINDS = ["person", "company", "job", "opportunity", "training", "link"];

async function ctxFrom(req: NextRequest) {
  const userId = await validateApiKey(req.headers.get("authorization"));
  if (!userId) return null;
  const svc = createServiceClient();
  const { data: p } = await svc.from("profiles").select("organization_id").eq("id", userId).maybeSingle();
  return { userId, orgId: p?.organization_id ?? null, svc };
}

/** GET — the caller's bookmark folders + bookmarks (for the extension's picker). */
export async function GET(req: NextRequest) {
  const ctx = await ctxFrom(req);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const [{ data: folders }, { data: items }] = await Promise.all([
    ctx.svc.from("bookmark_folders").select("*").eq("user_id", ctx.userId).order("position"),
    ctx.svc.from("bookmarks").select("*").eq("user_id", ctx.userId).order("created_at", { ascending: false }),
  ]);
  return NextResponse.json({ folders: folders ?? [], bookmarks: items ?? [] });
}

/** POST { type: "folder" | "bookmark", ... } — create a folder or a bookmark. */
export async function POST(req: NextRequest) {
  const ctx = await ctxFrom(req);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { type, ...row } = await req.json();

  if (type === "folder") {
    const { data, error } = await ctx.svc.from("bookmark_folders").insert({
      id: `bf${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
      user_id: ctx.userId, org_id: ctx.orgId,
      name: (row.name ?? "").trim() || "New folder",
      color: row.color || "#7c3aed",
      position: Number.isFinite(row.position) ? row.position : 0,
    }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data, { status: 201 });
  }

  const { data, error } = await ctx.svc.from("bookmarks").insert({
    id: `bm${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
    user_id: ctx.userId, org_id: ctx.orgId,
    folder_id: row.folder_id || null,
    kind: KINDS.includes(row.kind) ? row.kind : "link",
    title: (row.title ?? "").trim() || row.url || "Untitled",
    url: row.url || null,
    subtitle: row.subtitle || null,
    notes: row.notes || null,
    meta: row.meta && typeof row.meta === "object" ? row.meta : {},
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data, { status: 201 });
}

/** DELETE { id, type } */
export async function DELETE(req: NextRequest) {
  const ctx = await ctxFrom(req);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, type } = await req.json();
  const table = type === "folder" ? "bookmark_folders" : "bookmarks";
  await ctx.svc.from(table).delete().eq("id", id).eq("user_id", ctx.userId);
  return NextResponse.json({ ok: true });
}
