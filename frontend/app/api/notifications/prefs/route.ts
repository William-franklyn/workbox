import { NextRequest, NextResponse } from "next/server";
import { requireOrg } from "@/lib/auth/guard";

const DEFAULTS = {
  email_digest: "daily",
  notify_assigned: true,
  notify_comments: true,
  notify_due_soon: true,
  notify_mentions: true,
};

export async function GET(req: NextRequest) {
  const auth = await requireOrg(req);
  if ("error" in auth) return auth.error;
  const { ctx } = auth;

  const { data } = await ctx.svc
    .from("notification_prefs").select("*").eq("user_id", ctx.userId).maybeSingle();

  return NextResponse.json({ prefs: data ?? { user_id: ctx.userId, ...DEFAULTS } });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireOrg(req);
  if ("error" in auth) return auth.error;
  const { ctx } = auth;

  const body = await req.json();
  const patch: Record<string, unknown> = { user_id: ctx.userId, updated_at: new Date().toISOString() };

  if (["off", "daily", "weekly"].includes(body.email_digest)) patch.email_digest = body.email_digest;
  for (const k of ["notify_assigned", "notify_comments", "notify_due_soon", "notify_mentions"]) {
    if (typeof body[k] === "boolean") patch[k] = body[k];
  }

  const { data, error } = await ctx.svc
    .from("notification_prefs")
    .upsert(patch, { onConflict: "user_id" })
    .select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ prefs: data });
}
