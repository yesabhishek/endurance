import { Queue, type ConnectionOptions, type JobsOptions } from "bullmq";
import type { SyncSource } from "@prisma/client";

export const SYNC_QUEUE_NAME = "endurance-sync";

export type SyncJobData = {
  source: SyncSource;
  syncRunId: string;
};

const defaultJobOptions: JobsOptions = {
  attempts: 2,
  backoff: {
    type: "exponential",
    delay: 5_000,
  },
  removeOnComplete: {
    age: 60 * 60,
    count: 50,
  },
  removeOnFail: {
    age: 24 * 60 * 60,
    count: 100,
  },
};

export function getRedisConnection(): ConnectionOptions {
  const redisUrl = new URL(process.env.REDIS_URL ?? "redis://localhost:6379");

  return {
    host: redisUrl.hostname,
    port: Number(redisUrl.port || 6379),
    username: redisUrl.username || undefined,
    password: redisUrl.password || undefined,
    db: redisUrl.pathname && redisUrl.pathname !== "/" ? Number(redisUrl.pathname.slice(1)) : undefined,
    tls: redisUrl.protocol === "rediss:" ? {} : undefined,
    maxRetriesPerRequest: null,
  };
}

export function createSyncQueue() {
  return new Queue<SyncJobData>(SYNC_QUEUE_NAME, {
    connection: getRedisConnection(),
    defaultJobOptions,
  });
}
