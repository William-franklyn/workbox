import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const path = req.nextUrl.searchParams.get("path");
  const bucket = req.nextUrl.searchParams.get("bucket") ?? "documents";
  if (!path) return NextResponse.json({ error: "path required" }, { status: 400 });

  const sb = createServiceClient();
  const { data, error } = await sb.storage.from(bucket).createSignedUrl(path, 3600);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ url: data.signedUrl });
}
