import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-key";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const userId = await validateApiKey(req.headers.get("authorization"));
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createServiceClient();
  const { data: profile } = await supabase
    .from("profiles").select("organization_id").eq("id", userId).maybeSingle();
  const orgId = profile?.organization_id;
  if (!orgId) return NextResponse.json({ members: [] });

  const { data: members } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, created_at")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: true });

  return NextResponse.json({ members: members ?? [] });
}

export async function POST(req: NextRequest) {
  const userId = await validateApiKey(req.headers.get("authorization"));
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { email, role = "member" } = await req.json();
  if (!email) return NextResponse.json({ error: "email is required" }, { status: 400 });

  const supabase = createServiceClient();
  const { data: profile } = await supabase
    .from("profiles").select("organization_id").eq("id", userId).maybeSingle();
  const orgId = profile?.organization_id;

  const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
    data: { organization_id: orgId, role },
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ invited: true, email, user_id: data?.user?.id }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const userId = await validateApiKey(req.headers.get("authorization"));
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { member_id } = await req.json();
  if (!member_id) return NextResponse.json({ error: "member_id is required" }, { status: 400 });

  const supabase = createServiceClient();
  await supabase.from("profiles").update({ organization_id: null }).eq("id", member_id);
  return NextResponse.json({ ok: true });
}
