import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { verifyWebhookSignature } from "@/lib/billing/stripe";
import { planFromStripePrice } from "@/lib/billing/plans";

/**
 * Stripe webhook. Configure in the Stripe dashboard to send:
 *   checkout.session.completed
 *   customer.subscription.updated
 *   customer.subscription.deleted
 * Endpoint: POST /api/billing/webhook
 */
export async function POST(req: NextRequest) {
  const payload = await req.text();

  let event: Record<string, unknown>;
  try {
    event = verifyWebhookSignature(payload, req.headers.get("stripe-signature"));
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Invalid signature" },
      { status: 400 },
    );
  }

  const svc = createServiceClient();
  const type = event.type as string;
  const object = (event.data as { object: Record<string, unknown> }).object;

  if (type === "checkout.session.completed") {
    const orgId = (object.client_reference_id as string) ?? null;
    const customerId = object.customer as string;
    const subscriptionId = object.subscription as string;
    if (orgId && customerId) {
      await svc.from("organizations").update({
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId ?? null,
        plan_status: "active",
        updated_at: new Date().toISOString(),
      }).eq("id", orgId);
    }
  }

  if (type === "customer.subscription.updated" || type === "customer.subscription.created") {
    const metadata = (object.metadata as Record<string, string>) ?? {};
    const customerId = object.customer as string;
    const status = object.status as string;
    const items = (object.items as { data?: Array<{ price?: { id?: string }; quantity?: number }> })?.data ?? [];
    const priceId = items[0]?.price?.id ?? "";
    const quantity = items[0]?.quantity ?? 1;
    const plan = planFromStripePrice(priceId);

    const planStatus =
      status === "active" ? "active"
      : status === "trialing" ? "trialing"
      : status === "past_due" || status === "unpaid" ? "past_due"
      : "canceled";

    const patch: Record<string, unknown> = {
      plan_status: planStatus,
      stripe_subscription_id: object.id as string,
      updated_at: new Date().toISOString(),
    };
    if (plan) { patch.plan = plan; patch.seats = quantity; }

    // Prefer org from metadata; fall back to customer id lookup
    if (metadata.org_id) {
      await svc.from("organizations").update(patch).eq("id", metadata.org_id);
    } else if (customerId) {
      await svc.from("organizations").update(patch).eq("stripe_customer_id", customerId);
    }
  }

  if (type === "customer.subscription.deleted") {
    const metadata = (object.metadata as Record<string, string>) ?? {};
    const customerId = object.customer as string;
    const patch = {
      plan: "free",
      plan_status: "canceled",
      stripe_subscription_id: null,
      updated_at: new Date().toISOString(),
    };
    if (metadata.org_id) {
      await svc.from("organizations").update(patch).eq("id", metadata.org_id);
    } else if (customerId) {
      await svc.from("organizations").update(patch).eq("stripe_customer_id", customerId);
    }
  }

  return NextResponse.json({ received: true });
}
