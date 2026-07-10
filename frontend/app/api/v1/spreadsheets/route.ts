import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-key";
import { createServiceClient } from "@/lib/supabase/server";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://workbox-blue.vercel.app";

/**
 * Public spreadsheets API — backed by the spreadsheets table (the same one
 * the Univer editor uses). GET lists or reads (?id=), POST creates,
 * PATCH updates values/name.
 */

export async function GET(req: NextRequest) {
  const userId = await validateApiKey(req.headers.get("authorization"));
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createServiceClient();
  const { data: profile } = await supabase
    .from("profiles").select("organization_id").eq("id", userId).maybeSingle();
  const orgId = profile?.organization_id;
  if (!orgId) return NextResponse.json({ spreadsheets: [] });

  const id = req.nextUrl.searchParams.get("id");
  if (id) {
    const { data } = await supabase.from("spreadsheets")
      .select("id, name, col_headers, row_data, created_at, updated_at")
      .eq("id", id).eq("organization_id", orgId).maybeSingle();
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({
      spreadsheet: {
        id: data.id, title: data.name,
        headers: data.col_headers ?? [], rows: data.row_data ?? [],
        portal_link: `${BASE_URL}/spreadsheet/${data.id}`,
        created_at: data.created_at, updated_at: data.updated_at,
      },
    });
  }

  const { data } = await supabase.from("spreadsheets")
    .select("id, name, col_headers, row_data, created_at, updated_at")
    .eq("organization_id", orgId)
    .order("updated_at", { ascending: false });

  return NextResponse.json({
    spreadsheets: (data ?? []).map(d => ({
      id: d.id, title: d.name,
      headers: d.col_headers ?? [],
      row_count: (d.row_data as unknown[] ?? []).length,
      portal_link: `${BASE_URL}/spreadsheet/${d.id}`,
      created_at: d.created_at, updated_at: d.updated_at,
    })),
  });
}

export async function POST(req: NextRequest) {
  const userId = await validateApiKey(req.headers.get("authorization"));
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { title, headers = [], rows = [] } = await req.json();
  if (!title) return NextResponse.json({ error: "title is required" }, { status: 400 });

  const supabase = createServiceClient();
  const { data: profile } = await supabase
    .from("profiles").select("organization_id").eq("id", userId).maybeSingle();

  const sheetId = crypto.randomUUID();
  const { data, error } = await supabase.from("spreadsheets").insert({
    id: sheetId,
    name: title,
    organization_id: profile?.organization_id,
    created_by: userId,
    col_headers: (headers as string[]).length ? headers : ["A", "B", "C", "D", "E"],
    row_data: rows,
  }).select("id, name, created_at").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({
    spreadsheet: {
      id: data.id, title: data.name, headers, row_count: (rows as unknown[]).length,
      portal_link: `${BASE_URL}/spreadsheet/${sheetId}`,
      created_at: data.created_at,
    },
  }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const userId = await validateApiKey(req.headers.get("authorization"));
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, title, headers, rows } = await req.json();
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const supabase = createServiceClient();
  const { data: profile } = await supabase
    .from("profiles").select("organization_id").eq("id", userId).maybeSingle();
  const orgId = profile?.organization_id;

  const { data: sheet } = await supabase.from("spreadsheets")
    .select("id").eq("id", id).eq("organization_id", orgId ?? "").maybeSingle();
  if (!sheet) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (title) patch.name = title;
  if (headers) patch.col_headers = headers;
  if (rows) patch.row_data = rows;
  // API edits bypass the Univer editor — drop the stale snapshot so the
  // editor rebuilds from the fresh values on next open.
  if (headers || rows) patch.workbook = null;

  const { error } = await supabase.from("spreadsheets").update(patch).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
