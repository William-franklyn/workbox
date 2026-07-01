import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";
import { randomBytes } from "crypto";

// GET  → list guest invites for the org
// POST → send guest invite
// DELETE ?id=xxx → revoke invite

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const svc = createServiceClient();
  const { data: profile } = await svc.from("profiles").select("organization_id").eq("id", user.id).maybeSingle();
  const orgId = (profile as any)?.organization_id ?? user.id;

  const { data, error } = await svc.from("guest_invites")
    .select("*, inviter:invited_by(full_name)")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ guests: [] });
  return NextResponse.json({ guests: data ?? [] });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const svc = createServiceClient();
  const { data: profile } = await svc.from("profiles").select("organization_id").eq("id", user.id).maybeSingle();
  const orgId = (profile as any)?.organization_id ?? user.id;

  const body = await req.json();
  const { email, role = "guest", spaces = [] } = body;
  if (!email) return NextResponse.json({ error: "email is required" }, { status: 400 });

  const token = randomBytes(32).toString("hex");
  const id = `gi${Date.now()}`;

  const { data, error } = await svc.from("guest_invites").insert({
    id, email, org_id: orgId, invited_by: user.id, role, spaces, token,
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // In production: send invite email here
  const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/invite/${token}`;
  return NextResponse.json({ guest: data, invite_url: inviteUrl });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const svc = createServiceClient();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  await svc.from("guest_invites").delete().eq("id", id);
  return NextResponse.json({ ok: true });
}
