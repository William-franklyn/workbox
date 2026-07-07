"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, MessageSquare, Target, Clock, Users, Bot,
  CalendarDays, Plug, KeyRound, Zap, Layout, BarChart3,
  Briefcase, UserCheck, Activity, FormInput,
} from "lucide-react";

const NAV = [
  { icon: LayoutDashboard, href: "/home",                 label: "Home" },
  { icon: MessageSquare,   href: "/team-chat",            label: "Team Chat" },
  { icon: Bot,             href: "/chat/new",             label: "AI Agent" },
  { icon: CalendarDays,    href: "/meetings",             label: "Meetings" },
  { icon: Target,          href: "/goals",                label: "Goals" },
  { icon: BarChart3,       href: "/portfolio",            label: "Portfolio" },
  { icon: Briefcase,       href: "/workload",             label: "Workload" },
  { icon: Zap,             href: "/automations",          label: "Automations" },
  { icon: Layout,          href: "/templates",            label: "Templates" },
  { icon: FormInput,       href: "/forms",                label: "Forms" },
  { icon: Activity,        href: "/activity",             label: "Activity" },
  { icon: UserCheck,       href: "/guests",               label: "Guests" },
  { icon: Users,           href: "/settings?tab=members", label: "Members" },
  { icon: Clock,           href: "/timesheets",           label: "Timesheets" },
  { icon: Plug,            href: "/integrations",         label: "Integrations" },
  { icon: KeyRound,        href: "/settings/api-keys",    label: "API Keys" },
];

export default function IconRail({ userName }: { userName: string }) {
  const pathname = usePathname();
  const initial = userName?.[0]?.toUpperCase() ?? "?";

  return (
    <div
      className="flex flex-col items-center shrink-0 select-none z-10"
      style={{
        width: 52,
        minWidth: 52,
        background: "var(--bg-secondary)",
        borderRight: "1px solid var(--border)",
      }}
    >
      {/* Logo mark */}
      <div className="flex items-center justify-center w-full pt-3 pb-2">
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold shrink-0"
          style={{
            background: "#ffffff",
            color: "#000000",
            boxShadow: "0 0 0 1px rgba(255,255,255,0.15)",
          }}
        >
          W
        </div>
      </div>

      <div className="w-6 h-px mb-2 mx-auto" style={{ background: "var(--border)" }} />

      {/* Nav items */}
      <div
        className="flex-1 flex flex-col items-center w-full px-1.5 gap-0.5 overflow-y-auto py-1"
        style={{ scrollbarWidth: "none" }}
      >
        {NAV.map(({ icon: Icon, href, label }) => {
          const base = href.split("?")[0];
          const active = pathname === base || (base !== "/home" && pathname.startsWith(base));
          return (
            <Link
              key={href}
              href={href}
              className="relative w-full h-9 rounded-lg flex items-center justify-center group transition-all duration-100"
              style={{
                background: active ? "var(--bg-active)" : "transparent",
                color: active ? "#ffffff" : "var(--text-secondary)",
              }}
            >
              {active && (
                <span
                  className="absolute left-0 top-1/2 -translate-y-1/2 rounded-r-full"
                  style={{ width: 3, height: 18, background: "var(--accent-purple)" }}
                />
              )}
              <Icon size={16} strokeWidth={active ? 2.2 : 1.75} />
              <span
                className="absolute left-full ml-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap pointer-events-none z-50 opacity-0 group-hover:opacity-100 transition-opacity duration-100"
                style={{
                  background: "var(--bg-elevated)",
                  color: "var(--text-primary)",
                  border: "1px solid var(--border-strong)",
                  boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
                }}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>

      {/* User avatar */}
      <div className="pt-2 pb-3 flex justify-center w-full">
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold"
          style={{ background: "#ffffff", color: "#000000" }}
        >
          {initial}
        </div>
      </div>
    </div>
  );
}
