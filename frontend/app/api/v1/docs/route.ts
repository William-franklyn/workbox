import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-key";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const userId = await validateApiKey(req.headers.get("authorization"));
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createServiceClient();
  const { data: profile } = await supabase
    .from("profiles").select("organization_id").eq("id", userId).maybeSingle();

  const { data } = await supabase
    .from("docs")
    .select("id, title, created_at, updated_at")
    .eq("org_id", profile?.organization_id ?? "")
    .order("updated_at", { ascending: false });

  return NextResponse.json({ docs: data ?? [] });
}

export async function POST(req: NextRequest) {
  const userId = await validateApiKey(req.headers.get("authorization"));
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { title = "Untitled", content = "" } = await req.json();

  const supabase = createServiceClient();
  const { data: profile } = await supabase
    .from("profiles").select("organization_id").eq("id", userId).maybeSingle();

  const blocks = content
    ? [{ id: crypto.randomUUID(), type: "paragraph", content: [{ type: "text", text: content }] }]
    : [];

  const { data, error } = await supabase
    .from("docs")
    .insert({ id: crypto.randomUUID(), title, blocks, org_id: profile?.organization_id, created_by: userId })
    .select("id, title, created_at").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ doc: data }, { status: 201 });
}
