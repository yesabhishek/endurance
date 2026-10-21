import { getRedis } from "@/lib/redis";

type Window = { limit: number; windowSeconds: number };

export const LIMITS = {
  login: { limit: 10, windowSeconds: 15 * 60 },
  setup: { limit: 5, windowSeconds: 15 * 60 },
  chat: { limit: 30, windowSeconds: 60 },
  forecast: { limit: 10, windowSeconds: 60 * 60 },
  credentialTest: { limit: 20, windowSeconds: 10 * 60 },
  sync: { limit: 12, windowSeconds: 60 * 60 },
} satisfies Record<string, Window>;

// Fallback when Redis is unreachable, so a Redis outage never disables throttling.
const memory = new Map<string, { count: number; resetAt: number }>();

function memoryHit(key: string, window: Window) {
  const now = Date.now();
  const entry = memory.get(key);
  if (!entry || entry.resetAt <= now) {
    memory.set(key, { count: 1, resetAt: now + window.windowSeconds * 1000 });
    return { count: 1, retryAfter: window.windowSeconds };
  }
  entry.count += 1;
  if (memory.size > 10_000) {
    for (const [k, v] of memory) if (v.resetAt <= now) memory.delete(k);
  }
  return { count: entry.count, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
}

async function redisHit(key: string, window: Window) {
  const redis = getRedis();
  if (redis.status === "wait") await redis.connect();
  const results = await redis.multi().incr(key).expire(key, window.windowSeconds, "NX").ttl(key).exec();
  const count = Number(results?.[0]?.[1] ?? 0);
  const ttl = Number(results?.[2]?.[1] ?? window.windowSeconds);
  return { count, retryAfter: ttl > 0 ? ttl : window.windowSeconds };
}

/** Counts one hit against `bucket:id`. Returns whether the caller is still within the limit. */
export async function rateLimit(bucket: keyof typeof LIMITS, id: string) {
  const window = LIMITS[bucket];
  const key = `endurance:rl:${bucket}:${id}`;
  let result: { count: number; retryAfter: number };
  try {
    result = await redisHit(key, window);
  } catch {
    result = memoryHit(key, window);
  }
  return { ok: result.count <= window.limit, retryAfter: result.retryAfter, remaining: Math.max(0, window.limit - result.count) };
}

export async function clearRateLimit(bucket: keyof typeof LIMITS, id: string) {
  const key = `endurance:rl:${bucket}:${id}`;
  memory.delete(key);
  try {
    const redis = getRedis();
    if (redis.status === "wait") await redis.connect();
    await redis.del(key);
  } catch {
    // Best effort.
  }
}
