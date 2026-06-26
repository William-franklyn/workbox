import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("organization_id").eq("id", user.id).maybeSingle();
  const orgId = profile?.organization_id;

  const [{ data: spaces }, { data: folders }, { data: lists }] = await Promise.all([
    supabase.from("spaces").select("*").eq("org_id", orgId).order("position"),
    supabase.from("folders").select("*").order("position"),
    supabase.from("lists").select("*").order("position"),
  ]);

  return NextResponse.json({ spaces: spaces ?? [], folders: folders ?? [], lists: lists ?? [] });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("organization_id").eq("id", user.id).maybeSingle();
  const body = await req.json();
  const { type, ...row } = body;

  if (type === "space") {
    const { data, error } = await supabase.from("spaces").upsert({ ...row, org_id: profile?.organization_id }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data);
  }
  if (type === "folder") {
    const { data, error } = await supabase.from("folders").upsert(row).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data);
  }
  if (type === "list") {
    const { data, error } = await supabase.from("lists").upsert(row).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data);
  }

  return NextResponse.json({ error: "Invalid type" }, { status: 400 });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { type, id } = await req.json();
  const table = type === "space" ? "spaces" : type === "folder" ? "folders" : "lists";
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
