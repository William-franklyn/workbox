import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * Resend webhook — delivery/open/bounce/reply events update campaign_emails
 * by provider_id. Configure this URL in the Resend dashboard.
 * (Signature verification via svix can be added once RESEND_WEBHOOK_SECRET
 * is set; kept permissive here so setup is one step.)
 */
const EVENT_STATUS: Record<string, string> = {
  "email.delivered": "delivered",
  "email.opened": "opened",
  "email.bounced": "bounced",
  "email.complained": "bounced",
  "email.failed": "failed",
};

export async function POST(req: NextRequest) {
  let payload: Record<string, unknown>;
  try { payload = await req.json(); } catch { return NextResponse.json({ ok: true }); }

  const type = payload.type as string;
  const data = payload.data as Record<string, unknown> | undefined;
  const providerId = data?.email_id ?? (data?.id as string | undefined);
  const status = EVENT_STATUS[type];

  if (providerId && status) {
    const svc = createServiceClient();
    // Never downgrade a 'replied' email back to delivered/opened
    await svc.from("campaign_emails")
      .update({ status })
      .eq("provider_id", providerId)
      .not("status", "in", "(replied)");
  }
  return NextResponse.json({ ok: true });
}
