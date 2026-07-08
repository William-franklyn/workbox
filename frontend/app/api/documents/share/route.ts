import { NextRequest, NextResponse } from "next/server";
import { requireOrg, assertRowInOrg } from "@/lib/auth/guard";

function genToken(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(18)))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function POST(req: NextRequest) {
  const auth = await requireOrg(req);
  if ("error" in auth) return auth.error;
  const { ctx } = auth;
  if (ctx.role === "guest") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id, access } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const docErr = await assertRowInOrg(ctx, "org_documents", id);
  if (docErr) return docErr;

  if (access === "none") {
    await ctx.svc.from("org_documents").update({ share_token: null, share_access: "none" }).eq("id", id);
    return NextResponse.json({ share_token: null, share_access: "none" });
  }

  const { data: existing } = await ctx.svc.from("org_documents")
    .select("share_token").eq("id", id).maybeSingle();
  const token = (existing as { share_token: string | null } | null)?.share_token ?? genToken();

  await ctx.svc.from("org_documents")
    .update({ share_token: token, share_access: access ?? "view" }).eq("id", id);

  return NextResponse.json({ share_token: token, share_access: access ?? "view" });
}
