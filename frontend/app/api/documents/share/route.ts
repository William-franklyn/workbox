import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

function genToken(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(18)))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const svc = createServiceClient();
  const { id, access } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  if (access === "none") {
    await svc.from("org_documents").update({ share_token: null, share_access: "none" }).eq("id", id);
    return NextResponse.json({ share_token: null, share_access: "none" });
  }

  const { data: existing } = await svc.from("org_documents")
    .select("share_token").eq("id", id).maybeSingle();
  const token = (existing as { share_token: string | null } | null)?.share_token ?? genToken();

  await svc.from("org_documents")
    .update({ share_token: token, share_access: access ?? "view" }).eq("id", id);

  return NextResponse.json({ share_token: token, share_access: access ?? "view" });
}
