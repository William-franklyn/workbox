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

  return (
    <div
      className="flex items-center gap-1 px-4 shrink-0 overflow-x-auto"
      style={{ height: 46, borderBottom: "1px solid var(--border)", background: "var(--bg-primary)", scrollbarWidth: "none" }}
    >
      <span className="text-sm font-semibold mr-2 shrink-0" style={{ color: "var(--text-primary)" }}>
        {section.label}
      </span>
      {section.children.map((child) => {
        const active = matchesPath(child.href, pathname);
        const Icon = child.icon;
        return (
          <Link
            key={child.href}
            href={child.href}
            className="flex items-center gap-1.5 px-3 h-8 rounded-lg text-sm whitespace-nowrap transition-colors shrink-0 hover:bg-white/5"
            style={{
              color: active ? "#ffffff" : "var(--text-secondary)",
              background: active ? "var(--bg-active)" : "transparent",
              fontWeight: active ? 600 : 500,
            }}
          >
            <Icon size={14} className="shrink-0" style={{ opacity: 0.85 }} />
            {child.label}
          </Link>
        );
      })}
    </div>
  );
}
