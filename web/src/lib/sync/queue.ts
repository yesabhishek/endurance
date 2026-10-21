import { Queue, type JobsOptions } from "bullmq";
import type { SyncSource } from "@prisma/client";
import { redisOptions } from "@/lib/redis";

export const SYNC_QUEUE_NAME = "endurance-sync";

// Jobs carry ids only. Secrets and tokens are read from the database by the worker.
export type SyncJobData = {
  userId: string;
  source: SyncSource;
  syncRunId: string;
};

const defaultJobOptions: JobsOptions = {
  attempts: 2,
  backoff: { type: "exponential", delay: 5_000 },
  removeOnComplete: { age: 60 * 60, count: 500 },
  removeOnFail: { age: 24 * 60 * 60, count: 1000 },
};

let queue: Queue<SyncJobData> | null = null;

export function getSyncQueue() {
  queue ??= new Queue<SyncJobData>(SYNC_QUEUE_NAME, { connection: redisOptions(), defaultJobOptions });
  return queue;
}
