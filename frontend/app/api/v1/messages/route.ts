import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-key";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const userId = await validateApiKey(req.headers.get("authorization"));
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createServiceClient();
  const { data: profile } = await supabase
    .from("profiles").select("organization_id, full_name").eq("id", userId).maybeSingle();

  const limit = Number(req.nextUrl.searchParams.get("limit") ?? 50);
  const unread_only = req.nextUrl.searchParams.get("unread") === "true";

  // Get all messages in the org, or messages where user is mentioned
  let q = supabase
    .from("team_messages")
    .select("id, user_id, sender_name, content, mentions, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (profile?.organization_id) {
    q = q.eq("organization_id", profile.organization_id);
  }

  const { data: messages, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const all = (messages ?? []).reverse();

  // Separate messages mentioning the user
  const myMentions = all.filter(m =>
    m.user_id !== userId &&
    (m.mentions?.includes(userId) || m.mentions?.includes("all"))
  );

  return NextResponse.json({
    messages: all,
    total: all.length,
    mentions_me: myMentions,
    mentions_count: myMentions.length,
  });
}

export async function POST(req: NextRequest) {
  const userId = await validateApiKey(req.headers.get("authorization"));
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createServiceClient();
  const { data: profile } = await supabase
    .from("profiles").select("organization_id, full_name").eq("id", userId).maybeSingle();

  const { content, mention_names = [] } = await req.json();
  if (!content?.trim()) return NextResponse.json({ error: "content is required" }, { status: 400 });

  // Resolve @mention names to user IDs
  let mentions: string[] = [];
  if (mention_names.length) {
    const { data: members } = await supabase
      .from("profiles")
      .select("id, full_name")
      .eq("organization_id", profile?.organization_id ?? "");

    mentions = mention_names.map((name: string) => {
      if (name === "all") return "all";
      const match = (members ?? []).find(m =>
        m.full_name?.toLowerCase().includes(name.toLowerCase())
      );
      return match?.id ?? name;
    });
  }

  // Build message text with @mentions embedded
  let messageContent = content;
  if (mention_names.length) {
    const prefix = mention_names.map((n: string) => `@${n}`).join(" ");
    if (!messageContent.startsWith("@")) {
      messageContent = `${prefix} ${messageContent}`;
    }
  }

  const { data, error } = await supabase.from("team_messages").insert({
    id: crypto.randomUUID(),
    organization_id: profile?.organization_id ?? userId,
    user_id: userId,
    sender_name: profile?.full_name ?? "WorkBox AI",
    content: messageContent.trim(),
    mentions,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ message: data }, { status: 201 });
}
