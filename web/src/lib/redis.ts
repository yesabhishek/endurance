import IORedis, { type RedisOptions } from "ioredis";
import { getEnv } from "@/lib/env";

/** Connection options shared by BullMQ and the rate limiter. */
export function redisOptions(): RedisOptions {
  const url = new URL(getEnv().REDIS_URL);
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username ? decodeURIComponent(url.username) : undefined,
    password: url.password ? decodeURIComponent(url.password) : undefined,
    db: url.pathname && url.pathname !== "/" ? Number(url.pathname.slice(1)) : undefined,
    tls: url.protocol === "rediss:" ? {} : undefined,
    maxRetriesPerRequest: null,
  };
}

const globalForRedis = globalThis as unknown as { redis?: IORedis };

export function getRedis() {
  if (!globalForRedis.redis) {
    globalForRedis.redis = new IORedis({ ...redisOptions(), lazyConnect: true, enableOfflineQueue: false, maxRetriesPerRequest: 1 });
    globalForRedis.redis.on("error", () => {
      // Errors surface to callers; avoid crashing on background reconnect noise.
    });
  }
  return globalForRedis.redis;
}
