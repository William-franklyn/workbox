"use client";
import { useEffect, useState } from "react";
import { useUIStore } from "@/store/ui";
import { useWorkspaceStore } from "@/store/workspace";
import Sidebar from "./Sidebar";
import IconRail from "./IconRail";
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
  const { searchOpen, setSearchOpen, sidebarCollapsed, setSidebarCollapsed, toggleSidebar, setUserRole } = useUIStore();
  const { loadSpaces, setPersonalListId } = useWorkspaceStore();
  const [showShortcuts, setShowShortcuts] = useState(false);

  useEffect(() => {
    // Ensure personal workspace exists first, then load all spaces
    fetch("/api/personal-workspace")
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.list?.id) setPersonalListId(d.list.id);
      })
      .catch(() => {})
      .finally(() => loadSpaces());
  }, []);
  useEffect(() => { setUserRole(userRole); }, [userRole]);

  // Apply saved accent color
  useEffect(() => {
    const saved = localStorage.getItem("wb_accent_color");
    if (saved) document.documentElement.style.setProperty("--accent-purple", saved);
  }, []);

  // Auto-collapse sidebar on small screens
  useEffect(() => {
    function onResize() {
      if (window.innerWidth < 768) setSidebarCollapsed(true);
    }
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Global keyboard shortcuts
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      const inInput = tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement).isContentEditable;

      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setSearchOpen(true); return; }
      if ((e.metaKey || e.ctrlKey) && e.key === "b") { e.preventDefault(); toggleSidebar(); return; }
      if (!inInput && e.key === "?") { e.preventDefault(); setShowShortcuts((s) => !s); return; }
      if (e.key === "Escape" && showShortcuts) { setShowShortcuts(false); return; }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [setSearchOpen, toggleSidebar, showShortcuts]);

  const isMobileOpen = !sidebarCollapsed;

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--bg-primary)" }}>
      {/* Mobile backdrop */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-30 md:hidden" style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={() => setSidebarCollapsed(true)} />
      )}

      {/* Always-visible icon rail */}
      <IconRail userName={userName} />

      {/* Collapsible main sidebar */}
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
        <main className="flex-1 overflow-y-auto" style={{ background: "var(--bg-primary)" }}>
          {children}
        </main>
      </div>

      {searchOpen && <CommandPalette onClose={() => setSearchOpen(false)} />}
      <AIAssistant />

      {/* Keyboard shortcuts modal */}
      {showShortcuts && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.7)" }} onClick={() => setShowShortcuts(false)}>
          <div className="rounded-xl border p-6 w-80" style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }} onClick={(e) => e.stopPropagation()}>
            <h2 className="font-bold text-base mb-4" style={{ color: "var(--text-primary)" }}>Keyboard Shortcuts</h2>
            <div className="space-y-2">
              {[
                ["⌘K", "Search / Command palette"],
                ["⌘B", "Toggle sidebar"],
                ["?", "Show this help"],
                ["Esc", "Close panels"],
                ["↑↓ Enter", "Navigate command palette"],
                ["Tab", "Cycle block type in Docs"],
                ["Enter", "Add block in Docs"],
              ].map(([key, desc]) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{desc}</span>
                  <kbd className="text-xs px-2 py-0.5 rounded font-mono" style={{ background: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }}>{key}</kbd>
                </div>
              ))}
            </div>
            <button onClick={() => setShowShortcuts(false)} className="mt-4 w-full text-xs py-2 rounded-lg hover:opacity-80" style={{ background: "var(--bg-primary)", color: "var(--text-secondary)" }}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
