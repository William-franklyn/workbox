import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

async function orgOf(userId: string) {
  const svc = createServiceClient();
  const { data } = await svc.from("profiles").select("organization_id").eq("id", userId).maybeSingle();
  return { svc, orgId: data?.organization_id ?? null };
}

async function ownCampaign(svc: ReturnType<typeof createServiceClient>, id: string, orgId: string | null) {
  const { data } = await svc.from("campaigns").select("*").eq("id", id).maybeSingle();
  if (!data || data.org_id !== orgId) return null;
  return data;
}

/** GET /api/outreach/[id] — campaign + its emails (with contact names). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { svc, orgId } = await orgOf(user.id);

  const campaign = await ownCampaign(svc, id, orgId);
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: emails } = await svc.from("campaign_emails")
    .select("*, contact:crm_contacts(first_name, last_name, email)")
    .eq("campaign_id", id).order("created_at");
  return NextResponse.json({ campaign, emails: emails ?? [] });
}

/** PATCH /api/outreach/[id]
 *  { status } to move the campaign, or
 *  { email_id, ...fields } to edit/approve/exclude one email. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { svc, orgId } = await orgOf(user.id);

  const campaign = await ownCampaign(svc, id, orgId);
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();

  if (body.email_id) {
    const allowed = ["subject", "body", "status", "to_email"];
    const patch: Record<string, unknown> = {};
    for (const k of allowed) if (k in body) patch[k] = body[k];
    if (patch.status && !["draft", "approved", "excluded"].includes(patch.status as string)) {
      return NextResponse.json({ error: "Invalid email status" }, { status: 400 });
    }
    const { data, error } = await svc.from("campaign_emails")
      .update(patch).eq("id", body.email_id).eq("campaign_id", id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ email: data });
  }

  if (body.status) {
    if (!["draft", "ready", "active", "completed", "stopped"].includes(body.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    const { data, error } = await svc.from("campaigns").update({ status: body.status }).eq("id", id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ campaign: data });
  }

  return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
}

/** DELETE /api/outreach/[id] — creator/admin only (campaign cascade). */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { svc, orgId } = await orgOf(user.id);

  const campaign = await ownCampaign(svc, id, orgId);
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await svc.from("campaigns").delete().eq("id", id);
  return NextResponse.json({ ok: true });
}
