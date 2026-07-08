import crypto from "crypto";

/**
 * Minimal dependency-free Stripe REST client.
 * Stripe's API takes form-encoded bodies and returns JSON, so a thin wrapper
 * over fetch is all we need — no SDK required.
 */

const STRIPE_API = "https://api.stripe.com/v1";

function requireKey(): string {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
  return key;
}

/** Flattens nested objects into Stripe's form-encoding (a[b]=c, arr[0]=x). */
function encodeForm(params: Record<string, unknown>, prefix = ""): string[] {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) {
      v.forEach((item, i) => {
        if (typeof item === "object" && item !== null) {
          parts.push(...encodeForm(item as Record<string, unknown>, `${key}[${i}]`));
        } else {
          parts.push(`${encodeURIComponent(`${key}[${i}]`)}=${encodeURIComponent(String(item))}`);
        }
      });
    } else if (typeof v === "object") {
      parts.push(...encodeForm(v as Record<string, unknown>, key));
    } else {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
    }
  }
  return parts;
}

export async function stripeRequest<T = Record<string, unknown>>(
  method: "GET" | "POST" | "DELETE",
  path: string,
  params?: Record<string, unknown>,
): Promise<T> {
  const body = params ? encodeForm(params).join("&") : undefined;
  const url = method === "GET" && body ? `${STRIPE_API}${path}?${body}` : `${STRIPE_API}${path}`;

  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${requireKey()}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: method === "GET" ? undefined : body,
  });

  const json = await res.json();
  if (!res.ok) {
    const message = (json as { error?: { message?: string } }).error?.message ?? `Stripe error ${res.status}`;
    throw new Error(message);
  }
  return json as T;
}

export interface StripeCheckoutSession {
  id: string;
  url: string;
}

export async function createCheckoutSession(opts: {
  customerId?: string;
  customerEmail?: string;
  priceId: string;
  quantity: number;
  orgId: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<StripeCheckoutSession> {
  return stripeRequest<StripeCheckoutSession>("POST", "/checkout/sessions", {
    mode: "subscription",
    ...(opts.customerId ? { customer: opts.customerId } : { customer_email: opts.customerEmail }),
    line_items: [{ price: opts.priceId, quantity: opts.quantity }],
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
    client_reference_id: opts.orgId,
    subscription_data: { metadata: { org_id: opts.orgId } },
    allow_promotion_codes: true,
  });
}

export async function createBillingPortalSession(customerId: string, returnUrl: string): Promise<{ url: string }> {
  return stripeRequest<{ url: string }>("POST", "/billing_portal/sessions", {
    customer: customerId,
    return_url: returnUrl,
  });
}

/**
 * Verifies a Stripe webhook signature (Stripe-Signature header) and returns
 * the parsed event. Implements Stripe's documented scheme: HMAC-SHA256 over
 * "<timestamp>.<payload>" with the webhook signing secret.
 */
export function verifyWebhookSignature(payload: string, sigHeader: string | null): Record<string, unknown> {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
  if (!sigHeader) throw new Error("Missing Stripe-Signature header");

  const parts = Object.fromEntries(
    sigHeader.split(",").map(kv => kv.split("=") as [string, string])
  );
  const timestamp = parts["t"];
  const signature = parts["v1"];
  if (!timestamp || !signature) throw new Error("Malformed Stripe-Signature header");

  // Reject events older than 5 minutes (replay protection)
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) {
    throw new Error("Webhook timestamp outside tolerance");
  }

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${payload}`)
    .digest("hex");

  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(signature, "hex");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new Error("Webhook signature verification failed");
  }

  return JSON.parse(payload);
}
