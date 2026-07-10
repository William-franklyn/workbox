import posthog from "posthog-js";

/**
 * Feature-level analytics events. No-ops when PostHog isn't configured
 * (no key) or on the server, so call sites never need to guard.
 */
export function track(event: string, properties?: Record<string, unknown>): void {
  if (typeof window === "undefined" || !process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
  try {
    posthog.capture(event, properties);
  } catch { /* analytics must never break the app */ }
}

/** Tie events to the logged-in user (call after login/signup). */
export function identify(userId: string, traits?: Record<string, unknown>): void {
  if (typeof window === "undefined" || !process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
  try {
    posthog.identify(userId, traits);
  } catch { /* ignore */ }
}
