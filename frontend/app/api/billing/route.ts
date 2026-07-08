import { NextRequest, NextResponse } from "next/server";
import { requireOrg } from "@/lib/auth/guard";
import { getOrgBilling } from "@/lib/billing/entitlements";
import { PLANS } from "@/lib/billing/plans";

/** GET — current org plan, usage, and the plan catalog for the pricing UI. */
export async function GET(req: NextRequest) {
  const auth = await requireOrg(req);
  if ("error" in auth) return auth.error;
  const { ctx } = auth;

  const billing = await getOrgBilling(ctx.svc, ctx.orgId);

  const [{ count: memberCount }, { count: guestCount }, { count: automationCount }] = await Promise.all([
    ctx.svc.from("profiles").select("id", { count: "exact", head: true })
      .eq("organization_id", ctx.orgId).neq("role", "guest"),
    ctx.svc.from("guest_invites").select("id", { count: "exact", head: true })
      .eq("org_id", ctx.orgId),
    ctx.svc.from("automations").select("id", { count: "exact", head: true })
      .eq("org_id", ctx.orgId).eq("enabled", true),
  ]);

  return NextResponse.json({
    plan: billing.plan,
    plan_status: billing.planStatus,
    seats: billing.seats,
    usage: {
      members: memberCount ?? 0,
      guests: guestCount ?? 0,
      automations: automationCount ?? 0,
    },
    entitlements: {
      ...billing.entitlements,
      // JSON can't carry Infinity — send null for unlimited
      maxSeats: Number.isFinite(billing.entitlements.maxSeats) ? billing.entitlements.maxSeats : null,
      maxGuests: Number.isFinite(billing.entitlements.maxGuests) ? billing.entitlements.maxGuests : null,
      maxAutomations: Number.isFinite(billing.entitlements.maxAutomations) ? billing.entitlements.maxAutomations : null,
      automationRunsPerMonth: Number.isFinite(billing.entitlements.automationRunsPerMonth) ? billing.entitlements.automationRunsPerMonth : null,
      aiRequestsPerMonth: Number.isFinite(billing.entitlements.aiRequestsPerMonth) ? billing.entitlements.aiRequestsPerMonth : null,
      storageMb: Number.isFinite(billing.entitlements.storageMb) ? billing.entitlements.storageMb : null,
    },
    plans: Object.fromEntries(
      Object.entries(PLANS).map(([id, p]) => [id, { name: p.name, priceMonthly: p.priceMonthly }])
    ),
  });
}
