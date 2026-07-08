import { NextRequest, NextResponse } from "next/server";
import { requireOrg } from "@/lib/auth/guard";

export async function GET(req: NextRequest) {
  const auth = await requireOrg(req);
  if ("error" in auth) return auth.error;
  const { ctx } = auth;

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { data } = await ctx.svc.from("kb_articles")
    .select("*").eq("id", id).eq("org_id", ctx.orgId).maybeSingle();
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // increment view count
  await ctx.svc.from("kb_articles").update({ views: (data.views ?? 0) + 1 }).eq("id", id);
  return NextResponse.json(data);
}
