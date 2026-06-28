import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles").select("organization_id").eq("id", user.id).maybeSingle();
  if (!profile?.organization_id) return NextResponse.json([]);

  const limit = Number(req.nextUrl.searchParams.get("limit") ?? 60);
  const { data, error } = await supabase
    .from("team_messages")
    .select("*")
    .eq("organization_id", profile.organization_id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json((data ?? []).reverse());
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles").select("organization_id, full_name").eq("id", user.id).maybeSingle();
  if (!profile?.organization_id) return NextResponse.json({ error: "No workspace" }, { status: 400 });

  const { content, mentions } = await req.json();
  if (!content?.trim()) return NextResponse.json({ error: "Empty message" }, { status: 400 });

  const { data, error } = await supabase.from("team_messages").insert({
    id: crypto.randomUUID(),
    organization_id: profile.organization_id,
    user_id: user.id,
    sender_name: profile.full_name ?? "Unknown",
    content: content.trim(),
    mentions: mentions ?? [],
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}
