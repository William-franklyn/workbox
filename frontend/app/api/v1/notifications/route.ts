import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-key";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const userId = await validateApiKey(req.headers.get("authorization"));
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createServiceClient();
  const { data } = await supabase
    .from("notifications")
    .select("id, type, title, body, read, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  const unread = (data ?? []).filter(n => !n.read).length;
  return NextResponse.json({ notifications: data ?? [], unread_count: unread });
}

export async function PATCH(req: NextRequest) {
  const userId = await validateApiKey(req.headers.get("authorization"));
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, mark_all_read } = await req.json();
  const supabase = createServiceClient();

  if (mark_all_read) {
    await supabase.from("notifications").update({ read: true }).eq("user_id", userId);
  } else if (id) {
    await supabase.from("notifications").update({ read: true }).eq("id", id).eq("user_id", userId);
  }

  return NextResponse.json({ ok: true });
}
