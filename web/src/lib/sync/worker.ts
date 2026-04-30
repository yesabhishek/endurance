import type { Job } from "bullmq";
import type { SyncRun } from "@prisma/client";
import { getDb } from "@/lib/db";
import { syncGmailFinancialEmails } from "@/lib/gmail/sync";
import { syncKitePortfolio } from "@/lib/kite/sync";
import { createSyncNotification } from "@/lib/notifications";
import type { SyncJobData } from "./queue";

export async function processSyncJob(job: Job<SyncJobData>) {
  const { source, syncRunId } = job.data;

  try {
    const syncRun =
      source === "GMAIL"
        ? await syncGmailFinancialEmails({ syncRunId })
        : await syncKitePortfolio({ syncRunId });

    await createSyncNotification(syncRun);
    return syncRun;
  } catch (error) {
    if (isFinalAttempt(job)) {
      const syncRun = await markSyncRunFailed(syncRunId, error);
      await createSyncNotification(syncRun);
    }

    throw error;
  }
}

function isFinalAttempt(job: Job<SyncJobData>) {
  const attempts = typeof job.opts.attempts === "number" && job.opts.attempts > 0 ? job.opts.attempts : 1;
  return job.attemptsMade + 1 >= attempts;
}

async function markSyncRunFailed(syncRunId: string, error: unknown): Promise<SyncRun> {
  return getDb().syncRun.update({
    where: { id: syncRunId },
    data: {
      status: "FAILED",
      finishedAt: new Date(),
      error: error instanceof Error ? error.message : "Unknown sync error",
    },
  });
}
