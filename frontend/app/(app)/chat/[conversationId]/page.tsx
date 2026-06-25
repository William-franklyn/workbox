import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ChatWindow from "@/components/chat/ChatWindow";

interface Props {
  params: Promise<{ conversationId: string }>;
}

export default async function ChatPage({ params }: Props) {
  const { conversationId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .single();

  // Load existing messages
  const { data: messages } = await supabase
    .from("messages")
    .select("id, role, content, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  return (
    <ChatWindow
      conversationId={conversationId}
      organizationId={profile?.organization_id || ""}
      initialMessages={messages || []}
    />
  );
}
