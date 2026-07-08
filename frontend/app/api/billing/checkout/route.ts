import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { createCheckoutSession } from "@/lib/billing/stripe";
import { stripePriceFor, type PlanId } from "@/lib/billing/plans";

/** POST { plan: "pro" | "business", seats? } → Stripe Checkout URL (admins only). */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;
  const { ctx } = auth;

  const { plan, seats = 1 } = await req.json() as { plan: PlanId; seats?: number };
  const priceId = stripePriceFor(plan);
  if (!priceId) return NextResponse.json({ error: "Invalid plan" }, { status: 400 });

  const { data: org } = await ctx.svc
    .from("organizations")
    .select("stripe_customer_id")
    .eq("id", ctx.orgId)
    .maybeSingle();

  const { data: profile } = await ctx.svc
    .from("profiles").select("email").eq("id", ctx.userId).maybeSingle();

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  try {
    const session = await createCheckoutSession({
      customerId: org?.stripe_customer_id ?? undefined,
      customerEmail: org?.stripe_customer_id ? undefined : (profile?.email ?? undefined),
      priceId,
      quantity: Math.max(1, Math.min(500, seats)),
      orgId: ctx.orgId,
      successUrl: `${appUrl}/settings?billing=success`,
      cancelUrl: `${appUrl}/settings?billing=canceled`,
    });
    return NextResponse.json({ url: session.url });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Checkout failed" }, { status: 500 });
  }
}
