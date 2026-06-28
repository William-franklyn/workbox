"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, MessageSquare, Target, Clock, Users, Bot, CalendarDays, Plug } from "lucide-react";

const NAV = [
  { icon: LayoutDashboard, href: "/home",         label: "Home" },
  { icon: MessageSquare,   href: "/team-chat",    label: "Team Chat" },
  { icon: Bot,             href: "/chat/new",     label: "AI Assistant" },
  { icon: CalendarDays,    href: "/meetings",     label: "Meetings" },
  { icon: Target,          href: "/goals",        label: "Goals" },
  { icon: Users,           href: "/settings?tab=members", label: "Members" },
  { icon: Clock,           href: "/timesheets",   label: "Timesheets" },
  { icon: Plug,            href: "/integrations", label: "Integrations" },
];

export default function IconRail({ userName }: { userName: string }) {
  const pathname = usePathname();

  const initial = userName?.[0]?.toUpperCase() ?? "?";

  return (
    <div className="flex flex-col items-center shrink-0 border-r py-3 gap-1"
      style={{ width: 52, background: "var(--bg-secondary)", borderColor: "var(--border)" }}>

      {/* Logo */}
      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold text-white mb-3 shrink-0"
        style={{ background: "var(--accent-purple)" }}>
        W
      </div>

      {NAV.map(({ icon: Icon, href, label }) => {
        const active = pathname === href || pathname.startsWith(href.split("?")[0]);
        return (
          <Link key={href} href={href} title={label}
            className="relative w-9 h-9 rounded-lg flex items-center justify-center transition-colors group"
            style={{ background: active ? "rgba(124,58,237,0.18)" : "transparent", color: active ? "var(--accent-purple)" : "var(--text-secondary)" }}>
            <Icon size={17} />
            {/* Tooltip */}
            <span className="absolute left-full ml-2 px-2 py-1 rounded text-xs font-medium whitespace-nowrap pointer-events-none z-50 opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ background: "#1e293b", color: "var(--text-primary)", border: "1px solid var(--border)" }}>
              {label}
            </span>
          </Link>
        );
      })}

      {/* Bottom: user avatar */}
      <div className="mt-auto w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
        style={{ background: "var(--accent-purple)" }}>
        {initial}
      </div>
    </div>
  );
}
