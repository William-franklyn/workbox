import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { requireAdmin } from "@/lib/auth/guard";
import { requireFeature } from "@/lib/billing/entitlements";
import { WEBHOOK_EVENTS, type WebhookEvent } from "@/lib/webhooks";

/** GET — list webhook subscriptions (admins). Secrets are never returned. */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;
  const { ctx } = auth;

  const { data } = await ctx.svc
    .from("webhook_subscriptions")
    .select("id, url, events, active, created_at, last_delivery_at, last_delivery_status")
    .eq("org_id", ctx.orgId)
    .order("created_at", { ascending: false });

  return NextResponse.json({ webhooks: data ?? [], available_events: WEBHOOK_EVENTS });
}

/** POST { url, events } — create a subscription. The secret is returned ONCE. */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;
  const { ctx } = auth;

  const gateError = await requireFeature(ctx.svc, ctx.orgId, "webhooks");
  if (gateError) return NextResponse.json({ error: gateError, code: "plan_limit" }, { status: 402 });

  const { url, events } = await req.json() as { url: string; events: WebhookEvent[] };
  if (!url?.startsWith("https://") && !url?.startsWith("http://localhost")) {
    return NextResponse.json({ error: "url must be https" }, { status: 400 });
  }
  const validEvents = (events ?? []).filter(e => WEBHOOK_EVENTS.includes(e));
  if (validEvents.length === 0) {
    return NextResponse.json({ error: `events must include at least one of: ${WEBHOOK_EVENTS.join(", ")}` }, { status: 400 });
  }

  const secret = `whsec_${randomBytes(24).toString("base64url")}`;
  const { data, error } = await ctx.svc
    .from("webhook_subscriptions")
    .insert({ org_id: ctx.orgId, url, events: validEvents, secret, created_by: ctx.userId })
    .select("id, url, events, active, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // Secret is shown once, like an API key
  return NextResponse.json({ webhook: { ...data, secret } }, { status: 201 });
}

/** PATCH { id, active?, url?, events? } */
export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;
  const { ctx } = auth;

  const { id, ...body } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if (typeof body.active === "boolean") patch.active = body.active;
  if (typeof body.url === "string") patch.url = body.url;
  if (Array.isArray(body.events)) {
    patch.events = body.events.filter((e: string) => (WEBHOOK_EVENTS as string[]).includes(e));
  }

  const { data, error } = await ctx.svc
    .from("webhook_subscriptions")
    .update(patch).eq("id", id).eq("org_id", ctx.orgId)
    .select("id, url, events, active").maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ webhook: data });
}

/** DELETE ?id= */
export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;
  const { ctx } = auth;

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  await ctx.svc.from("webhook_subscriptions").delete().eq("id", id).eq("org_id", ctx.orgId);
  return NextResponse.json({ ok: true });
}
