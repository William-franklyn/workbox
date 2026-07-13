"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { NAV_SECTIONS, ADMIN_SECTION, matchesPath, type NavSection } from "./navConfig";
import BrandMark from "@/components/brand/BrandMark";

const RAIL_COLLAPSED = 56;
const RAIL_EXPANDED = 224;

function isSectionActive(section: NavSection, pathname: string): boolean {
  if (matchesPath(section.href, pathname)) return true;
  return section.children?.some((c) => matchesPath(c.href, pathname)) ?? false;
}

function RailItem({ section, active, expanded }: { section: NavSection; active: boolean; expanded: boolean }) {
  const Icon = section.icon;
  return (
    <Link
      href={section.href}
      title={section.label}
      className="relative flex items-center h-10 mx-2 rounded-lg transition-colors duration-100 hover:bg-white/5"
      style={{
        paddingLeft: 10,
        background: active ? "var(--bg-active)" : "transparent",
        color: active ? "#ffffff" : "var(--text-secondary)",
      }}
    >
      {active && (
        <span
          className="absolute top-1/2 -translate-y-1/2 rounded-r-full"
          style={{ left: -8, width: 3, height: 18, background: "var(--accent-purple)" }}
        />
      )}
      <Icon size={18} strokeWidth={active ? 2.2 : 1.75} className="shrink-0" />
      <span
        className="ml-3 text-sm font-medium whitespace-nowrap overflow-hidden transition-opacity duration-150"
        style={{ opacity: expanded ? 1 : 0 }}
      >
        {section.label}
      </span>
    </Link>
  );
}

export default function IconRail({ userName }: { userName: string }) {
  const pathname = usePathname();
  const initial = userName?.[0]?.toUpperCase() ?? "?";
  const [expanded, setExpanded] = useState(false);

  const settingsActive = isSectionActive(ADMIN_SECTION, pathname);

  return (
    // Outer reserves the collapsed width; the inner panel overlays on expand.
    <div className="relative shrink-0 z-50 select-none" style={{ width: RAIL_COLLAPSED }}>
      <div
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => setExpanded(false)}
        className="absolute inset-y-0 left-0 flex flex-col overflow-hidden"
        style={{
          width: expanded ? RAIL_EXPANDED : RAIL_COLLAPSED,
          background: "var(--bg-secondary)",
          borderRight: "1px solid var(--border)",
          transition: "width 180ms ease",
          boxShadow: expanded ? "8px 0 28px rgba(0,0,0,0.35)" : "none",
        }}
      >
        {/* Logo */}
        <div className="flex items-center h-14 shrink-0" style={{ paddingLeft: 12 }}>
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "#ffffff", boxShadow: "0 0 0 1px rgba(255,255,255,0.15)" }}
          >
            <BrandMark size={17} color="#0b0b12" />
          </div>
          <span
            className="ml-3 text-sm font-semibold whitespace-nowrap overflow-hidden transition-opacity duration-150"
            style={{ opacity: expanded ? 1 : 0, color: "var(--text-primary)" }}
          >
            WorkBox
          </span>
        </div>

        <div className="w-6 h-px mb-1 ml-3" style={{ background: "var(--border)" }} />

        {/* Primary sections */}
        <div className="flex-1 flex flex-col gap-0.5 overflow-y-auto py-1" style={{ scrollbarWidth: "none" }}>
          {NAV_SECTIONS.map((section, i) => (
            <div key={section.id} className="flex flex-col">
              {/* Divider between the core surfaces and the hubs */}
              {i === 4 && <div className="w-6 h-px my-1.5 ml-3" style={{ background: "var(--border)" }} />}
              <RailItem section={section} active={isSectionActive(section, pathname)} expanded={expanded} />
            </div>
          ))}
        </div>

        {/* Settings — pinned above the avatar so it's always reachable */}
        <div className="pb-1 pt-1">
          <div className="w-6 h-px mb-1 ml-3" style={{ background: "var(--border)" }} />
          <RailItem section={ADMIN_SECTION} active={settingsActive} expanded={expanded} />
        </div>

        {/* User avatar → profile settings */}
        <Link href="/settings" className="flex items-center h-14 shrink-0" style={{ paddingLeft: 12 }} title={userName || "Account"}>
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
            style={{ background: "#ffffff", color: "#000000" }}
          >
            {initial}
          </div>
          <span
            className="ml-3 text-sm font-medium whitespace-nowrap overflow-hidden transition-opacity duration-150"
            style={{ opacity: expanded ? 1 : 0, color: "var(--text-primary)" }}
          >
            {userName || "Account"}
          </span>
        </Link>
      </div>
    </div>
  );
}
