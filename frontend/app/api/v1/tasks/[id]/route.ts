import { NextRequest, NextResponse } from "next/server";
import { requireOrg } from "@/lib/auth/guard";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOrg(req);
  if ("error" in auth) return auth.error;
  const { ctx } = auth;

  const { id } = await params;
  const { data, error } = await ctx.svc
    .from("tasks").select("*").eq("id", id).eq("org_id", ctx.orgId).maybeSingle();
  if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ task: data });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOrg(req);
  if ("error" in auth) return auth.error;
  const { ctx } = auth;
  if (ctx.role === "guest") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const allowed = ["title", "status", "priority", "due_date", "tags", "description"];
  const patch: Record<string, unknown> = {};
  for (const k of allowed) { if (k in body) patch[k] = body[k]; }

  const { data, error } = await ctx.svc
    .from("tasks").update(patch).eq("id", id).eq("org_id", ctx.orgId).select().maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ task: data });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOrg(req);
  if ("error" in auth) return auth.error;
  const { ctx } = auth;
  if (ctx.role === "guest") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  await ctx.svc.from("tasks").delete().eq("id", id).eq("org_id", ctx.orgId);
  return NextResponse.json({ ok: true });
}
