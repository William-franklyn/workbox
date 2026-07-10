import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { enrichContact, ApolloNotConfiguredError } from "@/lib/enrich/apollo";

/**
 * POST /api/crm/enrich  { contact_id }
 * Fills missing email/phone/linkedin on a CRM contact via Apollo.io.
 * Service-role + org-scoped. Requires APOLLO_API_KEY.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const svc = createServiceClient();
  const { data: profile } = await svc.from("profiles").select("organization_id").eq("id", user.id).maybeSingle();
  const orgId = profile?.organization_id;

  const { contact_id } = await req.json();
  if (!contact_id) return NextResponse.json({ error: "contact_id is required" }, { status: 400 });

  const { data: contact } = await svc
    .from("crm_contacts")
    .select("id, first_name, last_name, org_id, email, phone, company:crm_companies(name)")
    .eq("id", contact_id)
    .maybeSingle();

  if (!contact || contact.org_id !== orgId) {
    return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  }

  const companyName = (contact.company as { name?: string } | null)?.name;
  if (!companyName) {
    return NextResponse.json({ error: "Add a company to this contact first — Apollo matches on name + company." }, { status: 400 });
  }

  try {
    const result = await enrichContact({
      first_name: contact.first_name,
      last_name: contact.last_name ?? "",
      company: companyName,
    });

    if (!result || (!result.email && !result.phone && !result.linkedin_url)) {
      return NextResponse.json({ found: false, message: "No match found in Apollo for this contact." });
    }

    // Only fill blanks — never overwrite data the user already entered
    const patch: Record<string, unknown> = { enriched_at: new Date().toISOString() };
    if (result.email && !contact.email) patch.email = result.email;
    if (result.phone && !contact.phone) patch.phone = result.phone;
    if (result.linkedin_url) patch.linkedin_url = result.linkedin_url;

    const { data: updated } = await svc.from("crm_contacts").update(patch).eq("id", contact_id).select().single();
    return NextResponse.json({ found: true, contact: updated, filled: { email: !!patch.email, phone: !!patch.phone, linkedin: !!patch.linkedin_url } });
  } catch (e) {
    if (e instanceof ApolloNotConfiguredError) {
      return NextResponse.json({ error: "Enrichment isn't configured. Add APOLLO_API_KEY in the deployment settings." }, { status: 503 });
    }
    return NextResponse.json({ error: "Enrichment failed. Try again shortly." }, { status: 502 });
  }
}
