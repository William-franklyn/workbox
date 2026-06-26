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
  const { searchOpen, setSearchOpen, sidebarCollapsed, setSidebarCollapsed } = useUIStore();
  const { loadSpaces } = useWorkspaceStore();

  useEffect(() => { loadSpaces(); }, []);

  // Auto-collapse sidebar on small screens
  useEffect(() => {
    function onResize() {
      if (window.innerWidth < 768) setSidebarCollapsed(true);
    }
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Cmd+K global shortcut
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setSearchOpen(true); }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [setSearchOpen]);

  const isMobileOpen = !sidebarCollapsed;

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--bg-primary)" }}>
      {/* Mobile backdrop */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-30 md:hidden" style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={() => setSidebarCollapsed(true)} />
      )}

      {/* Sidebar — fixed overlay on mobile, inline on desktop */}
      <div className={`
        md:relative md:flex md:shrink-0
        fixed inset-y-0 left-0 z-40
        transition-transform duration-200
        ${sidebarCollapsed ? "-translate-x-full md:translate-x-0" : "translate-x-0"}
      `}>
        <Sidebar orgName={orgName} userRole={userRole} userName={userName} userEmail={userEmail} userId={userId} />
      </div>

      <div className="flex flex-col flex-1 min-w-0">
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
