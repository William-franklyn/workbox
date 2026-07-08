import { NextRequest, NextResponse } from "next/server";
import { requireOrg, assertRowInOrg } from "@/lib/auth/guard";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const auth = await requireOrg(req);
  if ("error" in auth) return auth.error;
  const { ctx } = auth;
  if (ctx.role === "guest") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const formErr = await assertRowInOrg(ctx, "forms", id);
  if (formErr) return formErr;

  const { data, error } = await ctx.svc.from("form_submissions")
    .select("*, task:tasks(id, title, status)")
    .eq("form_id", id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data ?? []);
}
