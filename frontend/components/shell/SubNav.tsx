"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { sectionForPath, matchesPath } from "./navConfig";

/**
 * Contextual sub-navigation. When the current route belongs to a hub (Docs,
 * CRM, Insights, People, Settings), this renders that hub's children as tabs —
 * so nested surfaces stay one click apart even though they're no longer in the
 * icon rail. Renders nothing on standalone pages (Home, AI Agent, Goals, …).
 */
export default function SubNav() {
  const pathname = usePathname();
  const section = sectionForPath(pathname);
  if (!section?.children || section.children.length < 2) return null;
  const HubIcon = section.icon;

  return (
    <div
      className="flex items-center gap-2 px-4 shrink-0 overflow-x-auto"
      style={{
        height: 54,
        borderBottom: "1px solid var(--border)",
        background: "linear-gradient(180deg, var(--bg-secondary), var(--bg-primary))",
        boxShadow: "0 8px 20px -16px rgba(0,0,0,0.55)",
        scrollbarWidth: "none",
      }}
    >
      {/* Hub label with an icon badge for a touch of depth */}
      <div className="flex items-center gap-2.5 shrink-0">
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
          style={{
            background: "linear-gradient(145deg, rgba(139,92,246,0.20), rgba(109,40,217,0.12))",
            border: "1px solid rgba(124,58,237,0.28)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.18)",
            color: "var(--accent-purple)",
          }}
        >
          <HubIcon size={16} />
        </div>
        <span className="text-sm font-semibold shrink-0" style={{ color: "var(--text-primary)" }}>
          {section.label}
        </span>
      </div>

      <div className="w-px h-5 mx-1.5 shrink-0" style={{ background: "var(--border)" }} />

      {section.children.map((child) => {
        const active = matchesPath(child.href, pathname);
        const Icon = child.icon;
        return (
          <Link
            key={child.href}
            href={child.href}
            className="flex items-center gap-1.5 px-3 h-[34px] rounded-xl text-sm whitespace-nowrap shrink-0 transition-all duration-150 hover:bg-black/[0.05] dark:hover:bg-white/[0.06]"
            style={{
              color: active ? "#ffffff" : "var(--text-secondary)",
              fontWeight: active ? 600 : 500,
              ...(active
                ? {
                    background: "linear-gradient(145deg, #8b5cf6, #6d28d9)",
                    boxShadow: "0 5px 14px rgba(124,58,237,0.32), inset 0 1px 0 rgba(255,255,255,0.22)",
                  }
                : {}),
            }}
          >
            <Icon size={14} style={{ opacity: active ? 1 : 0.7 }} />
            {child.label}
          </Link>
        );
      })}
    </div>
  );
}
