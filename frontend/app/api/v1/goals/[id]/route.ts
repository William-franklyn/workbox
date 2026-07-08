import { NextRequest, NextResponse } from "next/server";
import { requireOrg, assertRowInOrg } from "@/lib/auth/guard";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOrg(req);
  if ("error" in auth) return auth.error;
  const { ctx } = auth;
  if (ctx.role === "guest") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();

  const goalErr = await assertRowInOrg(ctx, "goals", id);
  if (goalErr) return goalErr;

  // Update key result progress if kr_id provided
  if (body.kr_id !== undefined) {
    const { data, error } = await ctx.svc
      .from("key_results")
      .update({ current_value: body.current_value })
      .eq("id", body.kr_id).eq("goal_id", id)
      .select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ key_result: data });
  }

  // Update goal itself
  const allowed = ["title", "description", "due_date"];
  const patch: Record<string, unknown> = {};
  for (const k of allowed) { if (k in body) patch[k] = body[k]; }

  const { data, error } = await ctx.svc
    .from("goals").update(patch).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ goal: data });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOrg(req);
  if ("error" in auth) return auth.error;
  const { ctx } = auth;
  if (ctx.role === "guest") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const goalErr = await assertRowInOrg(ctx, "goals", id);
  if (goalErr) return goalErr;

  await ctx.svc.from("goals").delete().eq("id", id);
  return NextResponse.json({ ok: true });
}
