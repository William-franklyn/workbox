import { Ratelimit } from "@upstash/ratelimit";
import { NextResponse } from "next/server";
import { getRedis } from "./redis";

type Duration = `${number} ${"ms" | "s" | "m" | "h" | "d"}`;

const limiters = new Map<string, Ratelimit>();

function getLimiter(requests: number, window: Duration): Ratelimit | null {
  const redis = getRedis();
  if (!redis) return null;
  const key = `${requests}:${window}`;
  if (!limiters.has(key)) {
    limiters.set(key, new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(requests, window),
      prefix: "wb:rl",
    }));
  }
  return limiters.get(key)!;
}

export const TIERS = {
  ai:   { requests: 20,  window: "1 m" as Duration },
  auth: { requests: 10,  window: "1 m" as Duration },
  api:  { requests: 120, window: "1 m" as Duration },
} as const;

export type Tier = keyof typeof TIERS;

export async function rateLimit(
  identifier: string,
  tier: Tier = "api",
): Promise<{ success: boolean; headers: Record<string, string> }> {
  const { requests, window } = TIERS[tier];
  const limiter = getLimiter(requests, window);
  if (!limiter) return { success: true, headers: {} };

  const { success, limit, remaining, reset } = await limiter.limit(identifier);
  return {
    success,
    headers: {
      "X-RateLimit-Limit": String(limit),
      "X-RateLimit-Remaining": String(remaining),
      "X-RateLimit-Reset": String(reset),
    },
  };
}

export function rateLimitResponse(headers: Record<string, string>): NextResponse {
  return NextResponse.json(
    { error: "Too many requests — please slow down." },
    { status: 429, headers: { ...headers, "Retry-After": "60" } },
  );
}
