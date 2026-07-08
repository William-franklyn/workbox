import crypto from "crypto";
import { createServiceClient } from "@/lib/supabase/server";

export type WebhookEvent =
  | "task.created"
  | "task.updated"
  | "task.deleted"
  | "task.status_changed"
  | "comment.created"
  | "doc.created"
  | "form.submitted";

export const WEBHOOK_EVENTS: WebhookEvent[] = [
  "task.created", "task.updated", "task.deleted", "task.status_changed",
  "comment.created", "doc.created", "form.submitted",
];

/**
 * Fans an event out to every active subscription in the org that listens for
 * it. Fire-and-forget: callers should NOT await delivery in the request path —
 * call `void emitWebhook(...)`.
 *
 * Each delivery is signed: X-Workbox-Signature: sha256=<hmac(payload)>
 * so receivers can verify authenticity with their subscription secret.
 */
export async function emitWebhook(
  orgId: string,
  event: WebhookEvent,
  data: Record<string, unknown>,
): Promise<void> {
  try {
    const svc = createServiceClient();
    const { data: subs } = await svc
      .from("webhook_subscriptions")
      .select("id, url, secret, events")
      .eq("org_id", orgId)
      .eq("active", true)
      .contains("events", [event]);

    if (!subs?.length) return;

    const payload = JSON.stringify({
      event,
      org_id: orgId,
      timestamp: new Date().toISOString(),
      data,
    });

    await Promise.allSettled(subs.map(async sub => {
      const signature = crypto.createHmac("sha256", sub.secret).update(payload).digest("hex");
      let status: number | null = null;
      let error: string | null = null;
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(sub.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Workbox-Event": event,
            "X-Workbox-Signature": `sha256=${signature}`,
          },
          body: payload,
          signal: controller.signal,
        });
        clearTimeout(timer);
        status = res.status;
      } catch (e) {
        error = e instanceof Error ? e.message : "delivery failed";
      }

      await Promise.allSettled([
        svc.from("webhook_deliveries").insert({
          subscription_id: sub.id, event, payload: JSON.parse(payload), status, error,
        }),
        svc.from("webhook_subscriptions").update({
          last_delivery_at: new Date().toISOString(),
          last_delivery_status: status,
        }).eq("id", sub.id),
      ]);
    }));
  } catch {
    // Never let webhook fan-out break the calling request
  }
}
