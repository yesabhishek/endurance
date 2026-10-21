import { Worker } from "bullmq";
import { getEnv } from "@/lib/env";
import { redisOptions } from "@/lib/redis";
import { ensureSecurityMaster } from "@/lib/securities";
import { processSyncJob } from "@/lib/sync/worker";
import { SYNC_QUEUE_NAME, type SyncJobData } from "@/lib/sync/queue";

// Fail fast with a readable message when configuration is missing.
getEnv();

const concurrency = Math.max(1, Number(process.env.SYNC_WORKER_CONCURRENCY ?? 2));

const worker = new Worker<SyncJobData>(SYNC_QUEUE_NAME, processSyncJob, {
  connection: redisOptions(),
  concurrency,
});

worker.on("completed", (job) => console.log(`[worker] job ${job.id} completed`));
worker.on("failed", (job, error) => console.error(`[worker] job ${job?.id ?? "unknown"} failed: ${error.message}`));
worker.on("error", (error) => console.error("[worker] error", error.message));

console.log(`[worker] listening on ${SYNC_QUEUE_NAME} with concurrency ${concurrency}`);

// Warm the sector table so the first portfolio sync doesn't wait on it.
void ensureSecurityMaster();

async function shutdown() {
  await worker.close();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
