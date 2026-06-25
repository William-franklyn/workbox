"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface Props {
  userId: string;
  orgId: string;
  orgName: string;
  userRole: string;
  userName: string;
}

interface Conversation {
  id: string;
  title: string;
  updated_at: string;
}

export default function ConversationSidebar({ userId, orgId, orgName, userRole, userName }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [conversations, setConversations] = useState<Conversation[]>([]);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("conversations")
      .select("id, title, updated_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(30)
      .then(({ data }) => setConversations(data || []));
  }, [userId]);

  async function newChat() {
    router.push("/chat/new");
  }

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <aside className="w-64 flex flex-col bg-[#1a3c5e] text-white shrink-0">
      {/* Logo */}
      <div className="px-4 pt-5 pb-3 border-b border-white/10">
        <Image src="/logo-light.svg" alt="WorkBox" width={110} height={36} priority />
        <p className="text-xs text-blue-300 mt-2 truncate">{orgName}</p>
        <p className="text-xs text-blue-200 truncate">{userName}</p>
      </div>

      {/* New chat */}
      <div className="p-3">
        <button
          onClick={newChat}
          className="w-full text-sm bg-white/10 hover:bg-white/20 transition-colors rounded-lg px-3 py-2 text-left font-medium"
        >
          + New conversation
        </button>
      </div>

      {/* Conversation list */}
      <nav className="flex-1 overflow-y-auto px-3 pb-3 space-y-0.5">
        {conversations.map((c) => {
          const active = pathname === `/chat/${c.id}`;
          return (
            <Link
              key={c.id}
              href={`/chat/${c.id}`}
              className={`block text-sm px-3 py-2 rounded-lg truncate transition-colors ${
                active ? "bg-white/20 font-medium" : "hover:bg-white/10 text-blue-100"
              }`}
            >
              {c.title || "Untitled"}
            </Link>
          );
        })}
        {conversations.length === 0 && (
          <p className="text-xs text-blue-300 px-3 py-2">No conversations yet</p>
        )}
      </nav>

      {/* Footer links */}
      <div className="p-3 border-t border-white/10 space-y-1">
        <Link
          href="/integrations"
          className={`block text-sm px-3 py-2 rounded-lg transition-colors ${
            pathname === "/integrations" ? "bg-white/20 font-medium" : "hover:bg-white/10 text-blue-100"
          }`}
        >
          Integrations
        </Link>
        {userRole === "admin" && (
          <Link href="/dashboard" className="block text-sm px-3 py-2 rounded-lg hover:bg-white/10 text-blue-100 transition-colors">
            Admin Dashboard
          </Link>
        )}
        <button
          onClick={logout}
          className="w-full text-left text-sm px-3 py-2 rounded-lg hover:bg-white/10 text-blue-100 transition-colors"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
