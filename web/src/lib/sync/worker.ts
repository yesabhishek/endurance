import type { Job } from "bullmq";
import type { SyncRun } from "@prisma/client";
import { tenantDb } from "@/lib/db";
import { syncGmailFinancialEmails } from "@/lib/gmail/sync";
import { KiteReconnectRequired, syncKitePortfolio } from "@/lib/kite/sync";
import { createSyncNotification } from "@/lib/notifications";
import type { SyncJobData } from "./queue";

export async function processSyncJob(job: Job<SyncJobData>) {
  const { userId, source, syncRunId } = job.data;
  if (!userId || !syncRunId) throw new Error("Sync job is missing its user or run id.");

  try {
    const syncRun =
      source === "GMAIL" ? await syncGmailFinancialEmails({ userId, syncRunId }) : await syncKitePortfolio({ userId, syncRunId });
    await createSyncNotification(userId, syncRun);
    return { status: syncRun.status };
  } catch (error) {
    // Retrying cannot fix an expired login, so finish now instead of burning attempts.
    const final = error instanceof KiteReconnectRequired || isFinalAttempt(job);
    if (final) {
      const syncRun = await markSyncRunFailed(userId, syncRunId, error);
      await createSyncNotification(userId, syncRun);
      if (error instanceof KiteReconnectRequired) return { status: "FAILED" };
    }
    throw error;
  }
}

function isFinalAttempt(job: Job<SyncJobData>) {
  const attempts = typeof job.opts.attempts === "number" && job.opts.attempts > 0 ? job.opts.attempts : 1;
  return job.attemptsMade + 1 >= attempts;
}

async function markSyncRunFailed(userId: string, syncRunId: string, error: unknown): Promise<SyncRun> {
  const db = tenantDb(userId);
  const current = await db.syncRun.findUnique({ where: { id: syncRunId } });
  if (current?.status === "FAILED") return current;
  return db.syncRun.update({
    where: { id: syncRunId },
    data: {
      status: "FAILED",
      finishedAt: new Date(),
      error: error instanceof KiteReconnectRequired ? error.message : "The update could not finish.",
    },
  });
}
