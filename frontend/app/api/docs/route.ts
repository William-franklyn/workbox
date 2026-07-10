import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { reindexSource, removeSource } from "@/lib/embeddings";
import { blocksToText } from "@/lib/agent-runner";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("organization_id").eq("id", user.id).maybeSingle();
  const { data } = await supabase.from("docs").select("id, title, updated_at, created_at").eq("org_id", profile?.organization_id ?? "").order("updated_at", { ascending: false });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("organization_id").eq("id", user.id).maybeSingle();
  const body = await req.json();
  const { data, error } = await supabase.from("docs").insert({ ...body, org_id: profile?.organization_id, created_by: user.id }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const doc = data as Record<string, unknown>;
  void reindexSource("doc", doc.id as string, (doc.org_id as string) ?? null, (doc.title as string) ?? "", blocksToText(doc.blocks as unknown[] ?? []));
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, ...patch } = await req.json();
  const { data, error } = await supabase.from("docs").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const doc = data as Record<string, unknown>;
  void reindexSource("doc", doc.id as string, (doc.org_id as string) ?? null, (doc.title as string) ?? "", blocksToText(doc.blocks as unknown[] ?? []));
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  await supabase.from("docs").delete().eq("id", id);
  void removeSource("doc", id);
  return NextResponse.json({ ok: true });
}
