import { redirect } from "next/navigation";

// Old conversation-based chat routes redirect to the unified AI chat page
export default async function ConversationPage() {
  redirect("/chat/new");
}
