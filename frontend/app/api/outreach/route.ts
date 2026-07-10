import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { generateOutreachEmail } from "@/lib/outreach/draft";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";

const MAX_CONTACTS = 25; // cap synchronous drafting per campaign

async function ctx(userId: string) {
  const svc = createServiceClient();
  const { data } = await svc.from("profiles").select("organization_id, full_name").eq("id", userId).maybeSingle();
  return { svc, orgId: data?.organization_id ?? null, name: data?.full_name ?? "Me" };
}

/** GET /api/outreach — list campaigns with email counts. */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { svc, orgId } = await ctx(user.id);
  if (!orgId) return NextResponse.json({ campaigns: [] });

  const { data: campaigns } = await svc.from("campaigns")
    .select("*").eq("org_id", orgId).order("created_at", { ascending: false });

  const ids = (campaigns ?? []).map(c => c.id);
  const { data: emails } = ids.length
    ? await svc.from("campaign_emails").select("campaign_id, status").in("campaign_id", ids)
    : { data: [] };

  const counts: Record<string, Record<string, number>> = {};
  for (const e of (emails ?? [])) {
    counts[e.campaign_id] ??= {};
    counts[e.campaign_id][e.status] = (counts[e.campaign_id][e.status] ?? 0) + 1;
  }
  return NextResponse.json({ campaigns: (campaigns ?? []).map(c => ({ ...c, counts: counts[c.id] ?? {} })) });
}

/** POST /api/outreach — create a campaign and draft one email per contact.
 *  Body: { name, intent, contact_ids: string[], tone? } */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { success, headers } = await rateLimit(user.id, "ai");
  if (!success) return rateLimitResponse(headers);

  const { svc, orgId, name: senderName } = await ctx(user.id);
  if (!orgId) return NextResponse.json({ error: "No organization" }, { status: 400 });

  const { name, intent, contact_ids, tone } = await req.json();
  if (!name?.trim() || !intent?.trim() || !Array.isArray(contact_ids) || !contact_ids.length) {
    return NextResponse.json({ error: "name, intent and at least one contact are required" }, { status: 400 });
  }
  const ids = contact_ids.slice(0, MAX_CONTACTS);

  // Load contacts (org-scoped)
  const { data: contacts } = await svc.from("crm_contacts")
    .select("id, first_name, last_name, job_title, email, org_id, company:crm_companies(name)")
    .in("id", ids).eq("org_id", orgId);
  if (!contacts?.length) return NextResponse.json({ error: "No valid contacts" }, { status: 400 });

  const { data: org } = await svc.from("organizations").select("name").eq("id", orgId).maybeSingle();

  const { data: campaign, error: cErr } = await svc.from("campaigns")
    .insert({ org_id: orgId, name: name.trim(), intent: intent.trim(), created_by: user.id, status: "draft" })
    .select().single();
  if (cErr) return NextResponse.json({ error: cErr.message }, { status: 400 });

  // Draft each email in the sender's voice
  const rows = [];
  for (const c of contacts) {
    let subject = "", body = "";
    try {
      const draft = await generateOutreachEmail({
        orgId,
        sender: { name: senderName, company: org?.name },
        contact: { first_name: c.first_name, last_name: c.last_name, job_title: c.job_title, company: (c.company as { name?: string } | null)?.name },
        intent: intent.trim(), tone,
      });
      subject = draft.subject; body = draft.body;
    } catch { /* leave blank draft — user can write it in review */ }
    rows.push({
      campaign_id: campaign.id, contact_id: c.id, step_number: 1,
      to_email: c.email ?? null, subject, body,
      status: c.email ? "draft" : "excluded", // no email address → excluded until enriched
    });
  }
  await svc.from("campaign_emails").insert(rows);

  return NextResponse.json({ campaign_id: campaign.id, drafted: rows.length });
}
