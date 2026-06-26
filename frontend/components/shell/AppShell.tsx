"use client";
import { useEffect } from "react";
import { useUIStore } from "@/store/ui";
import { useWorkspaceStore } from "@/store/workspace";
import Sidebar from "./Sidebar";
import TopNav from "./TopNav";
import CommandPalette from "./CommandPalette";

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
  const { sidebarCollapsed, searchOpen, setSearchOpen } = useUIStore();

  // Seed demo spaces on first load if empty
  const { spaces, setSpaces } = useWorkspaceStore();
  useEffect(() => {
    if (spaces.length === 0) {
      setSpaces([
        {
          id: "s1", name: "Engineering", color: "#7c3aed", icon: "⚙️", expanded: true,
          folders: [
            {
              id: "f1", name: "Backend", space_id: "s1", expanded: false,
              lists: [
                { id: "l1", name: "API Tasks", folder_id: "f1", space_id: "s1", color: "#3b82f6", position: 0 },
              ],
            },
          ],
          lists: [
            { id: "l2", name: "Sprints", space_id: "s1", color: "#7c3aed", position: 0 },
          ],
        },
        {
          id: "s2", name: "Marketing", color: "#f59e0b", icon: "📣", expanded: false,
          folders: [],
          lists: [
            { id: "l3", name: "Campaigns", space_id: "s2", color: "#f59e0b", position: 0 },
          ],
        },
        {
          id: "s3", name: "Personal", color: "#22c55e", icon: "🏠", expanded: false,
          folders: [],
          lists: [
            { id: "l4", name: "My Tasks", space_id: "s3", color: "#22c55e", position: 0 },
          ],
        },
      ]);
    }
  }, []);

  // Cmd+K global shortcut
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [setSearchOpen]);

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--bg-primary)" }}>
      <Sidebar
        orgName={orgName}
        userRole={userRole}
        userName={userName}
        userEmail={userEmail}
        userId={userId}
      />
      <div
        className="flex flex-col flex-1 min-w-0 transition-all duration-200"
        style={{ marginLeft: 0 }}
      >
        <TopNav orgName={orgName} userName={userName} />
        <main
          className="flex-1 overflow-hidden"
          style={{ background: "var(--bg-primary)" }}
        >
          {children}
        </main>
      </div>
      {searchOpen && <CommandPalette onClose={() => setSearchOpen(false)} />}
    </div>
  );
}
