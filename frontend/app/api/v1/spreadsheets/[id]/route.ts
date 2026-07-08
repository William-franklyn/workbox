import { NextRequest, NextResponse } from "next/server";
import { requireOrg } from "@/lib/auth/guard";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://workbox-blue.vercel.app";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOrg(req);
  if ("error" in auth) return auth.error;
  const { ctx } = auth;

  const { id } = await params;
  const { data: doc } = await ctx.svc
    .from("docs").select("id, title, blocks, created_at, updated_at")
    .eq("id", id).eq("org_id", ctx.orgId).maybeSingle();

  if (!doc) return NextResponse.json({ error: "Spreadsheet not found" }, { status: 404 });

  const tableBlock = (doc.blocks as Array<Record<string, unknown>> ?? []).find(b => b.type === "table");

  return NextResponse.json({
    id: doc.id,
    title: (doc.title as string).replace("__sheet__", ""),
    headers: tableBlock?.headers ?? [],
    rows: tableBlock?.rows ?? [],
    portal_link: `${BASE_URL}/docs/${id}`,
    updated_at: doc.updated_at,
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOrg(req);
  if ("error" in auth) return auth.error;
  const { ctx } = auth;
  if (ctx.role === "guest") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const { rows, headers, title } = await req.json();

  const { data: doc } = await ctx.svc
    .from("docs").select("blocks, title").eq("id", id).eq("org_id", ctx.orgId).maybeSingle();
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const blocks = doc.blocks as Array<Record<string, unknown>> ?? [];
  const tableIdx = blocks.findIndex(b => b.type === "table");

  if (tableIdx >= 0) {
    if (headers) blocks[tableIdx].headers = headers;
    if (rows) blocks[tableIdx].rows = rows;
  } else {
    blocks.unshift({ id: crypto.randomUUID(), type: "table", headers: headers ?? [], rows: rows ?? [] });
  }

  const patch: Record<string, unknown> = { blocks, updated_at: new Date().toISOString() };
  if (title) patch.title = `__sheet__${title}`;

  const { data, error } = await ctx.svc
    .from("docs").update(patch).eq("id", id).eq("org_id", ctx.orgId)
    .select("id, title, updated_at").maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({
    spreadsheet: {
      id: data.id,
      title: (data.title as string).replace("__sheet__", ""),
      portal_link: `${BASE_URL}/docs/${id}`,
      updated_at: data.updated_at,
    },
  });
}
