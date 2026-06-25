import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function NewChatPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .single();

  // Create a new conversation and redirect to it
  const { data: convo } = await supabase
    .from("conversations")
    .insert({
      user_id: user.id,
      organization_id: profile?.organization_id,
      title: "New conversation",
    })
    .select()
    .single();

  if (convo) redirect(`/chat/${convo.id}`);

  redirect("/login");
}
