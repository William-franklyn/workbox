import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard, Bot, Target, CalendarDays,
  FolderOpen, Building2, PieChart, UsersRound, Settings,
  BookOpen, Layout, FormInput, StickyNote, Send,
  BarChart3, Briefcase, Activity, DollarSign,
  Users, UserCheck, Clock, Plug, Zap, KeyRound, Bookmark, Brain, Cpu, Workflow,
} from "lucide-react";

export interface NavChild { label: string; href: string; icon: LucideIcon }
export interface NavSection { id: string; label: string; href: string; icon: LucideIcon; children?: NavChild[] }

/**
 * Single source of truth for primary navigation. The icon rail, the contextual
 * sub-nav, and the command palette all read from this so they never drift.
 *
 * The Enterprise Intelligence IA (docs/VISION.md → Design principles):
 * Home / Knowledge / Agents / Workflows / Insights / Team / Integrations,
 * with Admin pinned as the settings gear. Every legacy module lives inside
 * one of these hubs — nothing else competes for top-level space.
 */
export const NAV_SECTIONS: NavSection[] = [
  { id: "home", label: "Home", href: "/home", icon: LayoutDashboard },
  {
    // The heart of the platform — ask, ingest, and browse org knowledge.
    id: "knowledge", label: "Knowledge", href: "/knowledge-hub", icon: Brain,
    children: [
      { label: "Knowledge Hub",  href: "/knowledge-hub", icon: Brain },
      { label: "Documents",      href: "/documents",     icon: FolderOpen },
      { label: "Knowledge Base", href: "/knowledge",     icon: BookOpen },
      { label: "Templates",      href: "/templates",     icon: Layout },
      { label: "Sticky Notes",   href: "/notes",         icon: StickyNote },
      { label: "Bookmarks",      href: "/bookmarks",     icon: Bookmark },
    ],
  },
  {
    id: "agents", label: "Agents", href: "/chat/new", icon: Bot,
    children: [
      { label: "AI Agent", href: "/chat/new", icon: Bot },
      { label: "Operator", href: "/operator", icon: Cpu },
    ],
  },
  {
    // Business work: goals, meetings, forms, customer pipeline, automation.
    id: "workflows", label: "Workflows", href: "/goals", icon: Workflow,
    children: [
      { label: "Goals",       href: "/goals",       icon: Target },
      { label: "Meetings",    href: "/meetings",    icon: CalendarDays },
      { label: "Forms",       href: "/forms",       icon: FormInput },
      { label: "CRM",         href: "/crm",         icon: Building2 },
      { label: "Outreach",    href: "/outreach",    icon: Send },
      { label: "Automations", href: "/automations", icon: Zap },
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
    id: "team", label: "Team", href: "/hr", icon: UsersRound,
    children: [
      { label: "Directory",  href: "/hr",                   icon: UsersRound },
      { label: "Members",    href: "/settings?tab=members", icon: Users },
      { label: "Guests",     href: "/guests",               icon: UserCheck },
      { label: "Timesheets", href: "/timesheets",           icon: Clock },
    ],
  },
  { id: "integrations", label: "Integrations", href: "/integrations", icon: Plug },
];

/** Admin/config — reached via the pinned Settings gear + command palette. */
export const ADMIN_SECTION: NavSection = {
  id: "settings", label: "Admin", href: "/settings", icon: Settings,
  children: [
    { label: "Settings", href: "/settings",          icon: Settings },
    { label: "API Keys", href: "/settings/api-keys", icon: KeyRound },
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
