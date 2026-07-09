import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("organization_id").eq("id", user.id).maybeSingle();
  const orgId = profile?.organization_id ?? "";

  const [{ data: goals }, { data: krs }] = await Promise.all([
    supabase.from("goals").select("*").eq("org_id", orgId).order("created_at"),
    supabase.from("key_results").select("*").order("created_at"),
  ]);

  return NextResponse.json({ goals: goals ?? [], keyResults: krs ?? [] });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("organization_id").eq("id", user.id).maybeSingle();
  const body = await req.json();
  const { type, ...row } = body;

  // Empty strings from optional form fields break typed columns (e.g. date)
  for (const k of Object.keys(row)) {
    if (row[k] === "") row[k] = null;
  }

  if (type === "goal") {
    const { data, error } = await supabase.from("goals").insert({ ...row, org_id: profile?.organization_id, created_by: user.id }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data);
  }
  if (type === "kr") {
    const { data, error } = await supabase.from("key_results").insert(row).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data);
  }
  return NextResponse.json({ error: "Invalid type" }, { status: 400 });
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, type, ...patch } = await req.json();
  const table = type === "goal" ? "goals" : "key_results";
  const { data, error } = await supabase.from(table).update(patch).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, type } = await req.json();
  const table = type === "goal" ? "goals" : "key_results";
  await supabase.from(table).delete().eq("id", id);
  return NextResponse.json({ ok: true });
}
