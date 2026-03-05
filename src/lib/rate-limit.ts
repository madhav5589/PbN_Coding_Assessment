import { redis } from "./redis";

/**
 * Simple sliding window rate limiter using Redis.
 * Returns { allowed: boolean, remaining: number, retryAfterMs?: number }
 */
export async function rateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): Promise<{ allowed: boolean; remaining: number; retryAfterMs?: number }> {
  const now = Date.now();
  const windowStart = now - windowMs;
  const rKey = `rl:${key}`;

  const pipeline = redis.pipeline();
  pipeline.zremrangebyscore(rKey, 0, windowStart);
  pipeline.zadd(rKey, now.toString(), `${now}:${Math.random().toString(36).slice(2, 8)}`);
  pipeline.zcard(rKey);
  pipeline.pexpire(rKey, windowMs);

  const results = await pipeline.exec();
  const count = (results?.[2]?.[1] as number) || 0;

  if (count > maxRequests) {
    const oldest = await redis.zrange(rKey, 0, 0, "WITHSCORES");
    const oldestTime = oldest.length >= 2 ? parseInt(oldest[1], 10) : now;
    const retryAfterMs = oldestTime + windowMs - now;
    return { allowed: false, remaining: 0, retryAfterMs: Math.max(retryAfterMs, 0) };
  }

  return { allowed: true, remaining: maxRequests - count };
}
