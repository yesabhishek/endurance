import type { SyncSource } from "@prisma/client";
import { getDb } from "@/lib/db";
import { createSyncQueue } from "./queue";

export async function enqueueSyncRun(source: SyncSource) {
  const db = getDb();
  const active = await db.syncRun.findFirst({
    where: {
      source,
      status: { in: ["QUEUED", "RUNNING"] },
    },
    orderBy: { startedAt: "desc" },
  });

  if (active) {
    return {
      syncRun: active,
      enqueued: false,
    };
  }

  const syncRun = await db.syncRun.create({
    data: {
      source,
      status: "QUEUED",
    },
  });

  const queue = createSyncQueue();
  try {
    await queue.add("sync", { source, syncRunId: syncRun.id }, { jobId: syncRun.id });
  } catch (error) {
    await db.syncRun.update({
      where: { id: syncRun.id },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        error: error instanceof Error ? error.message : "Unable to enqueue sync job",
      },
    });
    throw error;
  } finally {
    await queue.close();
  }

  return {
    syncRun,
    enqueued: true,
  };
}
