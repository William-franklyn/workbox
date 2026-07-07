import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const svc = createServiceClient();
  const { data } = await svc.from("kb_articles").select("*").eq("id", id).maybeSingle();
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // increment view count
  await svc.from("kb_articles").update({ views: (data.views ?? 0) + 1 }).eq("id", id);
  return NextResponse.json(data);
}
