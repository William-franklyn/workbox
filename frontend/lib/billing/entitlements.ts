import type { SupabaseClient } from "@supabase/supabase-js";
import { PLANS, type PlanId, type PlanEntitlements } from "./plans";

export interface OrgBilling {
  plan: PlanId;
  planStatus: string;
  seats: number;
  entitlements: PlanEntitlements & { name: string; priceMonthly: number };
}

export async function getOrgBilling(svc: SupabaseClient, orgId: string): Promise<OrgBilling> {
  const { data: org } = await svc
    .from("organizations")
    .select("plan, plan_status, seats")
    .eq("id", orgId)
    .maybeSingle();

  const plan = ((org?.plan as PlanId) ?? "free") in PLANS ? ((org?.plan as PlanId) ?? "free") : "free";
  // past_due/canceled orgs fall back to free-tier limits but keep their data
  const effectivePlan: PlanId =
    org?.plan_status === "canceled" || org?.plan_status === "past_due" ? "free" : plan;

  return {
    plan,
    planStatus: org?.plan_status ?? "active",
    seats: org?.seats ?? PLANS[effectivePlan].maxSeats,
    entitlements: PLANS[effectivePlan],
  };
}

/** Returns an error string if the org can't add another member, else null. */
export async function checkSeatAvailable(svc: SupabaseClient, orgId: string): Promise<string | null> {
  const billing = await getOrgBilling(svc, orgId);
  const { count } = await svc
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .neq("role", "guest");

  const limit = Math.min(billing.seats, billing.entitlements.maxSeats);
  if ((count ?? 0) >= limit) {
    return `Your ${billing.entitlements.name} plan is limited to ${limit} seats. Upgrade to add more members.`;
  }
  return null;
}

/** Returns an error string if the org can't add another guest, else null. */
export async function checkGuestAvailable(svc: SupabaseClient, orgId: string): Promise<string | null> {
  const billing = await getOrgBilling(svc, orgId);
  const { count } = await svc
    .from("guest_invites")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId);

  if ((count ?? 0) >= billing.entitlements.maxGuests) {
    return `Your ${billing.entitlements.name} plan is limited to ${billing.entitlements.maxGuests} guests. Upgrade for more.`;
  }
  return null;
}

/** Returns an error string if the org hit its automation limit, else null. */
export async function checkAutomationAvailable(svc: SupabaseClient, orgId: string): Promise<string | null> {
  const billing = await getOrgBilling(svc, orgId);
  const { count } = await svc
    .from("automations")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("enabled", true);

  if ((count ?? 0) >= billing.entitlements.maxAutomations) {
    return `Your ${billing.entitlements.name} plan allows ${billing.entitlements.maxAutomations} active automations. Upgrade for more.`;
  }
  return null;
}

/** Feature-flag check, e.g. requireFeature(svc, orgId, "webhooks"). */
export async function requireFeature(
  svc: SupabaseClient,
  orgId: string,
  feature: keyof PlanEntitlements["features"],
): Promise<string | null> {
  const billing = await getOrgBilling(svc, orgId);
  if (!billing.entitlements.features[feature]) {
    return `This feature requires a paid plan. You're on ${billing.entitlements.name}.`;
  }
  return null;
}
