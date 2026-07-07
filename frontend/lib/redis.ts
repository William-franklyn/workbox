import { Redis } from "@upstash/redis";

let _redis: Redis | null = null;

export function getRedis(): Redis | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return null;
  if (!_redis) {
    _redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
  return _redis;
}

export async function cache<T>(key: string, ttl: number, fn: () => Promise<T>): Promise<T> {
  const redis = getRedis();
  if (redis) {
    try {
      const hit = await redis.get<T>(key);
      if (hit !== null && hit !== undefined) return hit;
    } catch { /* ignore cache errors, fall through to fn */ }
  }
  const value = await fn();
  if (redis) {
    try { await redis.set(key, value, { ex: ttl }); } catch { /* ignore */ }
  }
  return value;
}

export async function invalidate(...keys: string[]): Promise<void> {
  const redis = getRedis();
  if (!redis || !keys.length) return;
  try { await redis.del(...keys); } catch { /* ignore */ }
}
