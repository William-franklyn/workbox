import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-key";
import { createServiceClient } from "@/lib/supabase/server";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://workbox-blue.vercel.app";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await validateApiKey(req.headers.get("authorization"));
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const supabase = createServiceClient();

  const { data: doc } = await supabase
    .from("docs").select("id, title, blocks, created_at, updated_at").eq("id", id).maybeSingle();

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
  const userId = await validateApiKey(req.headers.get("authorization"));
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { rows, headers, title } = await req.json();
  const supabase = createServiceClient();

  const { data: doc } = await supabase
    .from("docs").select("blocks, title").eq("id", id).maybeSingle();
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

  const { data, error } = await supabase
    .from("docs").update(patch).eq("id", id).select("id, title, updated_at").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({
    spreadsheet: {
      id: data.id,
      title: (data.title as string).replace("__sheet__", ""),
      portal_link: `${BASE_URL}/docs/${id}`,
      updated_at: data.updated_at,
    },
  });
}
