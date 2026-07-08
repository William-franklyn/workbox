import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { createBillingPortalSession } from "@/lib/billing/stripe";

/** POST → Stripe billing portal URL for managing the subscription (admins only). */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;
  const { ctx } = auth;

  const { data: org } = await ctx.svc
    .from("organizations")
    .select("stripe_customer_id")
    .eq("id", ctx.orgId)
    .maybeSingle();

  if (!org?.stripe_customer_id) {
    return NextResponse.json({ error: "No billing account yet — subscribe to a plan first" }, { status: 400 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  try {
    const session = await createBillingPortalSession(org.stripe_customer_id, `${appUrl}/settings`);
    return NextResponse.json({ url: session.url });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Portal failed" }, { status: 500 });
  }
}
