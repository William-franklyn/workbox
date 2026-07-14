import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-key";
import { createServiceClient } from "@/lib/supabase/server";
import { enrichContact, ApolloNotConfiguredError } from "@/lib/enrich/apollo";

/** GET /api/v1/crm — recent contacts (with company name). */
export async function GET(req: NextRequest) {
  const userId = await validateApiKey(req.headers.get("authorization"));
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const svc = createServiceClient();
  const { data: p } = await svc.from("profiles").select("organization_id").eq("id", userId).maybeSingle();
  const orgId = p?.organization_id;
  const { data } = await svc.from("crm_contacts")
    .select("*, company:crm_companies(id,name)")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(100);
  return NextResponse.json({ contacts: data ?? [] });
}

/**
 * POST /api/v1/crm — create a contact (and its company if new). Used by the
 * extension to save a LinkedIn lead. `enrich !== false` fills email/phone via
 * Apollo when a full name + company are known. If only a company is given, a
 * company record is created instead.
 */
export async function POST(req: NextRequest) {
  const userId = await validateApiKey(req.headers.get("authorization"));
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const svc = createServiceClient();
  const { data: p } = await svc.from("profiles").select("organization_id").eq("id", userId).maybeSingle();
  const orgId = p?.organization_id ?? null;

  const body = await req.json();
  const first_name = (body.first_name ?? "").trim();
  const last_name = (body.last_name ?? "").trim();
  const company = (body.company ?? "").trim();
  const enrich = body.enrich !== false;

  if (!first_name && !company) {
    return NextResponse.json({ error: "first_name or company is required" }, { status: 400 });
  }

  // Resolve / create the company.
  let company_id: string | null = null;
  if (company) {
    const { data: existing } = await svc.from("crm_companies").select("id").eq("org_id", orgId).ilike("name", company).maybeSingle();
    if (existing) company_id = existing.id;
    else {
      const { data: co } = await svc.from("crm_companies").insert({ name: company, org_id: orgId, created_by: userId }).select("id").single();
      company_id = co?.id ?? null;
    }
  }

  // Company-only save (no person named).
  if (!first_name) {
    return NextResponse.json({ company_id }, { status: 201 });
  }

  // Best-effort enrichment.
  let email: string | null = body.email || null;
  let phone: string | null = body.phone || null;
  let apollo: string | null = null;
  if (enrich && first_name && last_name && company) {
    try {
      const r = await enrichContact({ first_name, last_name, company });
      if (r) { email = email || r.email; phone = phone || r.phone; apollo = r.linkedin_url; }
    } catch (e) {
      if (!(e instanceof ApolloNotConfiguredError)) { /* ignore lookup failures */ }
    }
  }

  const linkedin_url = body.linkedin_url || body.url || apollo || null;

  const insertRow = {
    first_name, last_name: last_name || null,
    email, phone,
    job_title: body.job_title || null,
    linkedin_url,
    company_id, org_id: orgId, created_by: userId,
    status: "lead", notes: body.notes || null,
  };
  const sel = "*, company:crm_companies(id,name)";
  let { data, error } = await svc.from("crm_contacts").insert(insertRow).select(sel).single();
  // Resilient to migration 031 (linkedin_url) not being applied yet.
  if (error && /linkedin_url/.test(error.message)) {
    const { linkedin_url: _drop, ...rest } = insertRow;
    const notes = [insertRow.notes, linkedin_url ? `LinkedIn: ${linkedin_url}` : null].filter(Boolean).join("\n") || null;
    ({ data, error } = await svc.from("crm_contacts").insert({ ...rest, notes }).select(sel).single());
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ contact: data }, { status: 201 });
}
