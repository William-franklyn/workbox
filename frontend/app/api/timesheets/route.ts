import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data } = await supabase.from("time_entries").select("*").eq("user_id", user.id).order("date", { ascending: false });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const { data: profile } = await supabase.from("profiles").select("organization_id").eq("id", user.id).maybeSingle();
  const { data, error } = await supabase.from("time_entries").insert({ ...body, id: crypto.randomUUID(), user_id: user.id, org_id: profile?.organization_id }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await req.json();
  await supabase.from("time_entries").delete().eq("id", id).eq("user_id", user.id);
  return NextResponse.json({ ok: true });
}
