"use client";
import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import posthog from "posthog-js";

/**
 * PostHog product analytics — no-op until NEXT_PUBLIC_POSTHOG_KEY is set.
 * Captures pageviews on route change; add posthog.capture() calls for
 * feature-level events as needed.
 */

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";

if (typeof window !== "undefined" && KEY && !posthog.__loaded) {
  posthog.init(KEY, {
    api_host: HOST,
    capture_pageview: false, // captured manually on route change below
    persistence: "localStorage+cookie",
  });
}

function PageviewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!KEY || !pathname) return;
    let url = window.origin + pathname;
    const qs = searchParams?.toString();
    if (qs) url += `?${qs}`;
    posthog.capture("$pageview", { $current_url: url });
  }, [pathname, searchParams]);

  return null;
}

export default function PostHogProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      {KEY && (
        <Suspense fallback={null}>
          <PageviewTracker />
        </Suspense>
      )}
      {children}
    </>
  );
}
