import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { sendEmail, sendingConfigured, SendNotConfiguredError } from "@/lib/outreach/resend";

/** POST /api/outreach/[id]/send — send all approved emails in the campaign. */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const svc = createServiceClient();
  const { data: profile } = await svc.from("profiles").select("organization_id").eq("id", user.id).maybeSingle();
  const orgId = profile?.organization_id ?? null;

  const { data: campaign } = await svc.from("campaigns").select("*").eq("id", id).maybeSingle();
  if (!campaign || campaign.org_id !== orgId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!sendingConfigured()) {
    return NextResponse.json({ error: "Email sending isn't configured. Add RESEND_API_KEY and RESEND_FROM." }, { status: 503 });
  }

  const { data: emails } = await svc.from("campaign_emails")
    .select("*").eq("campaign_id", id).eq("status", "approved");
  if (!emails?.length) return NextResponse.json({ error: "No approved emails to send." }, { status: 400 });

  let sent = 0, failed = 0;
  for (const e of emails) {
    if (!e.to_email) { await svc.from("campaign_emails").update({ status: "excluded" }).eq("id", e.id); continue; }
    try {
      const result = await sendEmail({ to: e.to_email, subject: e.subject, body: e.body });
      if (result.id) {
        await svc.from("campaign_emails").update({ status: "sent", provider_id: result.id, sent_at: new Date().toISOString() }).eq("id", e.id);
        sent++;
      } else {
        await svc.from("campaign_emails").update({ status: "failed" }).eq("id", e.id);
        failed++;
      }
    } catch (err) {
      if (err instanceof SendNotConfiguredError) {
        return NextResponse.json({ error: "Email sending isn't configured." }, { status: 503 });
      }
      await svc.from("campaign_emails").update({ status: "failed" }).eq("id", e.id);
      failed++;
    }
  }

  await svc.from("campaigns").update({ status: "active" }).eq("id", id);
  return NextResponse.json({ sent, failed });
}
