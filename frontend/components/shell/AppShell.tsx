"use client";
import { useEffect } from "react";
import { useUIStore } from "@/store/ui";
import { useWorkspaceStore } from "@/store/workspace";
import Sidebar from "./Sidebar";
import TopNav from "./TopNav";
import CommandPalette from "./CommandPalette";
import AIAssistant from "@/components/ai/AIAssistant";

interface Props {
  userId: string;
  orgId: string;
  orgName: string;
  userRole: string;
  userName: string;
  userEmail: string;
  children: React.ReactNode;
}

export default function AppShell({ userId, orgId, orgName, userRole, userName, userEmail, children }: Props) {
  const { searchOpen, setSearchOpen } = useUIStore();
  const { loadSpaces } = useWorkspaceStore();

  // Load spaces/folders/lists from Supabase on mount
  useEffect(() => { loadSpaces(); }, []);

  // Cmd+K global shortcut
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setSearchOpen(true); }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [setSearchOpen]);

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--bg-primary)" }}>
      <Sidebar orgName={orgName} userRole={userRole} userName={userName} userEmail={userEmail} userId={userId} />
      <div className="flex flex-col flex-1 min-w-0 transition-all duration-200">
        <TopNav orgName={orgName} userName={userName} userId={userId} />
        <main className="flex-1 overflow-hidden" style={{ background: "var(--bg-primary)" }}>
          {children}
        </main>
      </div>
      {searchOpen && <CommandPalette onClose={() => setSearchOpen(false)} />}
      <AIAssistant />
    </div>
  );
}
