import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-key";
import { createServiceClient } from "@/lib/supabase/server";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://workbox-blue.vercel.app";

/** Spreadsheets are stored as docs with a special table block as the first block.
 *  Title prefix "__sheet__" marks them as spreadsheets for filtering.
 */

export async function GET(req: NextRequest) {
  const userId = await validateApiKey(req.headers.get("authorization"));
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createServiceClient();
  const { data: profile } = await supabase
    .from("profiles").select("organization_id").eq("id", userId).maybeSingle();

  const q = supabase
    .from("docs")
    .select("id, title, blocks, created_at, updated_at")
    .like("title", "__sheet__%")
    .order("updated_at", { ascending: false });

  const { data } = profile?.organization_id
    ? await q.eq("org_id", profile.organization_id)
    : await q;

  const sheets = (data ?? []).map(d => {
    const tableBlock = (d.blocks as Array<Record<string, unknown>> ?? []).find(b => b.type === "table");
    return {
      id: d.id,
      title: (d.title as string).replace("__sheet__", ""),
      headers: tableBlock?.headers ?? [],
      row_count: (tableBlock?.rows as unknown[][] ?? []).length,
      portal_link: `${BASE_URL}/docs/${d.id}`,
      created_at: d.created_at,
      updated_at: d.updated_at,
    };
  });

  return NextResponse.json({ spreadsheets: sheets });
}

export async function POST(req: NextRequest) {
  const userId = await validateApiKey(req.headers.get("authorization"));
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { title, headers = [], rows = [], description } = await req.json();
  if (!title) return NextResponse.json({ error: "title is required" }, { status: 400 });

  const supabase = createServiceClient();
  const { data: profile } = await supabase
    .from("profiles").select("organization_id").eq("id", userId).maybeSingle();

  const blocks: unknown[] = [
    // Table block with the data
    {
      id: crypto.randomUUID(),
      type: "table",
      headers,
      rows,
    },
  ];

  if (description) {
    blocks.push({
      id: crypto.randomUUID(),
      type: "paragraph",
      content: [{ type: "text", text: description }],
    });
  }

  const docId = crypto.randomUUID();
  const { data, error } = await supabase
    .from("docs")
    .insert({
      id: docId,
      title: `__sheet__${title}`,
      blocks,
      org_id: profile?.organization_id,
      created_by: userId,
    })
    .select("id, title, created_at").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({
    spreadsheet: {
      id: data.id,
      title,
      headers,
      row_count: rows.length,
      portal_link: `${BASE_URL}/docs/${docId}`,
      created_at: data.created_at,
    },
  }, { status: 201 });
}
