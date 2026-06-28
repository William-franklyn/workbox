import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  const folderId = req.nextUrl.searchParams.get("folderId");

  if (id) {
    const { data, error } = await supabase.from("spreadsheets").select("*").eq("id", id).maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data);
  }

  if (folderId) {
    const { data, error } = await supabase.from("spreadsheets").select("id,name,col_headers,created_at,updated_at")
      .eq("folder_id", folderId).order("created_at", { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data ?? []);
  }

  return NextResponse.json({ error: "id or folderId required" }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("organization_id").eq("id", user.id).maybeSingle();
  if (!profile?.organization_id) return NextResponse.json({ error: "No workspace" }, { status: 400 });

  const { folderId, name } = await req.json();
  const { data, error } = await supabase.from("spreadsheets").insert({
    id: crypto.randomUUID(),
    folder_id: folderId,
    organization_id: profile.organization_id,
    created_by: user.id,
    name: name ?? "Untitled Spreadsheet",
    col_headers: ["A", "B", "C", "D", "E"],
    row_data: Array(10).fill(null).map(() => Array(5).fill("")),
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, ...patch } = await req.json();
  const { data, error } = await supabase.from("spreadsheets")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  const { error } = await supabase.from("spreadsheets").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
