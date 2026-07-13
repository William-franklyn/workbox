import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard, Bot, Target, CalendarDays,
  FolderOpen, Building2, PieChart, UsersRound, Settings,
  BookOpen, Layout, FormInput, StickyNote, Send,
  BarChart3, Briefcase, Activity, DollarSign,
  Users, UserCheck, Clock, Plug, Zap, KeyRound,
} from "lucide-react";

export interface NavChild { label: string; href: string; icon: LucideIcon }
export interface NavSection { id: string; label: string; href: string; icon: LucideIcon; children?: NavChild[] }

/**
 * Single source of truth for primary navigation. The icon rail, the contextual
 * sub-nav, and the command palette all read from this so they never drift.
 *
 * Design: only 8 primary destinations live in the rail. Related surfaces are
 * nested as children (shown as tabs inside the hub); admin/config lives under
 * Settings (ADMIN_SECTION) rather than competing for top-level space.
 */
export const NAV_SECTIONS: NavSection[] = [
  { id: "home",     label: "Home",     href: "/home",     icon: LayoutDashboard },
  { id: "agent",    label: "AI Agent", href: "/chat/new", icon: Bot },
  { id: "goals",    label: "Goals",    href: "/goals",    icon: Target },
  { id: "meetings", label: "Meetings", href: "/meetings", icon: CalendarDays },
  {
    id: "docs", label: "Docs", href: "/documents", icon: FolderOpen,
    children: [
      { label: "Documents",      href: "/documents", icon: FolderOpen },
      { label: "Knowledge Base", href: "/knowledge", icon: BookOpen },
      { label: "Templates",      href: "/templates", icon: Layout },
      { label: "Forms",          href: "/forms",     icon: FormInput },
      { label: "Sticky Notes",   href: "/notes",     icon: StickyNote },
    ],
  },
  {
    id: "crm", label: "CRM", href: "/crm", icon: Building2,
    children: [
      { label: "Contacts", href: "/crm",      icon: Building2 },
      { label: "Outreach", href: "/outreach", icon: Send },
    ],
  },
  {
    id: "insights", label: "Insights", href: "/reports", icon: PieChart,
    children: [
      { label: "Reports",   href: "/reports",   icon: PieChart },
      { label: "Portfolio", href: "/portfolio", icon: BarChart3 },
      { label: "Workload",  href: "/workload",  icon: Briefcase },
      { label: "Activity",  href: "/activity",  icon: Activity },
      { label: "Budget",    href: "/budget",    icon: DollarSign },
    ],
  },
  {
    id: "people", label: "People", href: "/hr", icon: UsersRound,
    children: [
      { label: "Directory",  href: "/hr",                   icon: UsersRound },
      { label: "Members",    href: "/settings?tab=members", icon: Users },
      { label: "Guests",     href: "/guests",               icon: UserCheck },
      { label: "Timesheets", href: "/timesheets",           icon: Clock },
    ],
  },
];

/** Admin/config — reached via the pinned Settings gear + command palette. */
export const ADMIN_SECTION: NavSection = {
  id: "settings", label: "Settings", href: "/settings", icon: Settings,
  children: [
    { label: "Settings",     href: "/settings",          icon: Settings },
    { label: "Integrations", href: "/integrations",      icon: Plug },
    { label: "Automations",  href: "/automations",       icon: Zap },
    { label: "API Keys",     href: "/settings/api-keys", icon: KeyRound },
  ],
};

/** True when `pathname` falls under `href` (query-param hrefs never path-match). */
export function matchesPath(href: string, pathname: string): boolean {
  if (href.includes("?")) return false;
  const base = href.split("?")[0];
  if (pathname === base) return true;
  // Landing routes shouldn't swallow their nested siblings.
  if (base === "/home" || base === "/settings" || base === "/") return false;
  return pathname.startsWith(base + "/");
}

/** The section (primary or admin) that owns the current path, if any. */
export function sectionForPath(pathname: string): NavSection | undefined {
  const all = [...NAV_SECTIONS, ADMIN_SECTION];
  return all.find(
    (s) => matchesPath(s.href, pathname) || s.children?.some((c) => matchesPath(c.href, pathname)),
  );
}
