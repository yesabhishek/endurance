import { Worker } from "bullmq";
import { processSyncJob } from "@/lib/sync/worker";
import { getRedisConnection, SYNC_QUEUE_NAME, type SyncJobData } from "@/lib/sync/queue";

const concurrency = Number(process.env.SYNC_WORKER_CONCURRENCY ?? 1);

const worker = new Worker<SyncJobData>(SYNC_QUEUE_NAME, processSyncJob, {
  connection: getRedisConnection(),
  concurrency,
});

worker.on("completed", (job) => {
  console.log(`Sync job completed: ${job.id}`);
});

worker.on("failed", (job, error) => {
  console.error(`Sync job failed: ${job?.id ?? "unknown"}`, error);
});

worker.on("error", (error) => {
  console.error("Sync worker error", error);
});

console.log(`Sync worker listening on ${SYNC_QUEUE_NAME} with concurrency ${concurrency}`);

async function shutdown() {
  await worker.close();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
