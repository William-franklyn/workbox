import { NextRequest, NextResponse } from "next/server";
import { requireOrg } from "@/lib/auth/guard";

const ALLOWED_BUCKETS = new Set(["documents"]);

export async function GET(req: NextRequest) {
  const auth = await requireOrg(req);
  if ("error" in auth) return auth.error;
  const { ctx } = auth;

  const path = req.nextUrl.searchParams.get("path");
  const bucket = req.nextUrl.searchParams.get("bucket") ?? "documents";
  if (!path) return NextResponse.json({ error: "path required" }, { status: 400 });

  if (!ALLOWED_BUCKETS.has(bucket)) {
    return NextResponse.json({ error: "Invalid bucket" }, { status: 400 });
  }
  // Uploads are stored under "<orgId>/<timestamp>-<name>" — only allow files
  // inside the caller's org prefix (and reject traversal).
  if (path.includes("..") || !path.startsWith(`${ctx.orgId}/`)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data, error } = await ctx.svc.storage.from(bucket).createSignedUrl(path, 3600);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ url: data.signedUrl });
}
