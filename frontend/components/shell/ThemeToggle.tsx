"use client";
import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

/** Applies a theme everywhere the app reads it: the CSS-var switch
 *  (data-theme), the Tailwind class (.dark), and persistence (localStorage). */
export function applyTheme(t: "light" | "dark") {
  try {
    localStorage.setItem("wb_theme", t);
  } catch {}
  const d = document.documentElement;
  d.setAttribute("data-theme", t);
  d.classList.toggle("dark", t === "dark");
}

export default function ThemeToggle({ className, style }: { className?: string; style?: React.CSSProperties }) {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const t = (typeof localStorage !== "undefined" && (localStorage.getItem("wb_theme") as "light" | "dark")) || "light";
    setTheme(t);
    setReady(true);
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
  }

  return (
    <button
      onClick={toggle}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      title={theme === "dark" ? "Light mode" : "Dark mode"}
      className={className ?? "w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-white/5"}
      style={{ color: "var(--text-secondary)", ...style }}
    >
      {ready && theme === "dark" ? <Sun size={16} strokeWidth={1.75} /> : <Moon size={16} strokeWidth={1.75} />}
    </button>
  );
}
