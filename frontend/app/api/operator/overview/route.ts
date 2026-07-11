import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { isOperator } from "@/lib/operator";

// Rough monthly value per plan for an MRR estimate (adjust to real pricing).
const PLAN_PRICE: Record<string, number> = { free: 0, starter: 12, pro: 29, business: 79, enterprise: 199 };

/** GET /api/operator/overview — cross-org platform metrics. Operator-only. */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isOperator(user.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const svc = createServiceClient();

  const [{ data: orgs }, { data: profiles }, { count: totalUsers }] = await Promise.all([
    svc.from("organizations").select("id, name, plan, plan_status, seats, stripe_subscription_id, created_at, created_by"),
    svc.from("profiles").select("id, organization_id, role, created_at, email, full_name"),
    svc.from("profiles").select("id", { count: "exact", head: true }),
  ]);

  const membersByOrg: Record<string, number> = {};
  for (const p of profiles ?? []) if (p.organization_id) membersByOrg[p.organization_id] = (membersByOrg[p.organization_id] ?? 0) + 1;
  const ownerEmail: Record<string, string> = {};
  for (const p of profiles ?? []) ownerEmail[p.id] = p.email;

  const planCounts: Record<string, number> = {};
  let mrr = 0, paying = 0;
  for (const o of orgs ?? []) {
    planCounts[o.plan] = (planCounts[o.plan] ?? 0) + 1;
    if (o.plan !== "free" && o.plan_status === "active") { mrr += PLAN_PRICE[o.plan] ?? 0; paying++; }
  }

  const orgList = (orgs ?? [])
    .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))
    .map(o => ({
      id: o.id, name: o.name, plan: o.plan, plan_status: o.plan_status,
      members: membersByOrg[o.id] ?? 0, owner_email: ownerEmail[o.created_by] ?? null,
      created_at: o.created_at,
    }));

  const recentUsers = (profiles ?? [])
    .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))
    .slice(0, 12)
    .map(p => ({ email: p.email, name: p.full_name, role: p.role, created_at: p.created_at }));

  return NextResponse.json({
    totals: { orgs: (orgs ?? []).length, users: totalUsers ?? 0, paying, mrr },
    planCounts,
    orgs: orgList,
    recentUsers,
  });
}
