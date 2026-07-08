import { NextRequest, NextResponse } from "next/server";
import { requireOrg, assertSpaceInOrg } from "@/lib/auth/guard";

export async function POST(req: NextRequest) {
  const auth = await requireOrg(req);
  if ("error" in auth) return auth.error;
  const { ctx } = auth;
  if (ctx.role === "guest") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { name, space_id, color = "#7c3aed" } = await req.json();
  if (!name || !space_id) return NextResponse.json({ error: "name and space_id are required" }, { status: 400 });

  const spaceErr = await assertSpaceInOrg(ctx, space_id);
  if (spaceErr) return spaceErr;

  const { count } = await ctx.svc
    .from("lists").select("id", { count: "exact", head: true }).eq("space_id", space_id);

  const { data, error } = await ctx.svc
    .from("lists")
    .insert({ id: `l${Date.now()}`, name, space_id, color, position: count ?? 0 })
    .select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ list: data }, { status: 201 });
}
