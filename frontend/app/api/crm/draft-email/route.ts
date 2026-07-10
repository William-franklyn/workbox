import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { generateOutreachEmail, DraftPlaceholderError } from "@/lib/outreach/draft";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";

/**
 * POST /api/crm/draft-email  { contact_id, intent, tone?, useMergeTag? }
 * Drafts a personalized outreach email for a CRM contact in the sender's voice.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { success, headers } = await rateLimit(user.id, "ai");
  if (!success) return rateLimitResponse(headers);

  const { contact_id, intent, tone, useMergeTag } = await req.json();
  if (!contact_id || !intent?.trim()) {
    return NextResponse.json({ error: "contact_id and intent are required" }, { status: 400 });
  }

  const svc = createServiceClient();
  const { data: profile } = await svc.from("profiles")
    .select("organization_id, full_name").eq("id", user.id).maybeSingle();
  const orgId = profile?.organization_id ?? null;

  const [{ data: contact }, { data: org }] = await Promise.all([
    svc.from("crm_contacts").select("first_name, last_name, job_title, org_id, company:crm_companies(name)").eq("id", contact_id).maybeSingle(),
    orgId ? svc.from("organizations").select("name").eq("id", orgId).maybeSingle() : Promise.resolve({ data: null }),
  ]);

  if (!contact || contact.org_id !== orgId) {
    return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  }

  try {
    const draft = await generateOutreachEmail({
      orgId,
      sender: { name: profile?.full_name ?? "Me", company: (org as { name?: string } | null)?.name },
      contact: {
        first_name: contact.first_name,
        last_name: contact.last_name,
        job_title: contact.job_title,
        company: (contact.company as { name?: string } | null)?.name,
      },
      intent: intent.trim(),
      tone,
      useMergeTag: !!useMergeTag,
    });
    return NextResponse.json({ draft });
  } catch (e) {
    if (e instanceof DraftPlaceholderError) {
      return NextResponse.json({ error: "The draft came back incomplete — try rephrasing your intent." }, { status: 422 });
    }
    return NextResponse.json({ error: "Couldn't draft the email right now." }, { status: 502 });
  }
}
