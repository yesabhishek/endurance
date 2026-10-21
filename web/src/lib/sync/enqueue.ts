import type { SyncSource } from "@prisma/client";
import type { TenantDb } from "@/lib/db";
import { getSyncQueue } from "./queue";

const STALE_AFTER_MS = 15 * 60 * 1000;

/**
 * Queues a sync for one user. A user can have one active sync per source;
 * other users are never blocked. Runs stuck for 15 minutes are treated as dead.
 */
export async function enqueueSyncRun(db: TenantDb, userId: string, source: SyncSource) {
  const active = await db.syncRun.findFirst({
    where: { userId, source, status: { in: ["QUEUED", "RUNNING"] } },
    orderBy: { startedAt: "desc" },
  });

  if (active && Date.now() - active.startedAt.getTime() < STALE_AFTER_MS) {
    return { syncRun: active, enqueued: false };
  }
  if (active) {
    await db.syncRun.update({
      where: { id: active.id },
      data: { status: "FAILED", finishedAt: new Date(), error: "Timed out before finishing." },
    });
  }

  const syncRun = await db.syncRun.create({ data: { userId, source, status: "QUEUED" } });

  try {
    await getSyncQueue().add("sync", { userId, source, syncRunId: syncRun.id }, { jobId: syncRun.id });
  } catch (error) {
    await db.syncRun.update({
      where: { id: syncRun.id },
      data: { status: "FAILED", finishedAt: new Date(), error: "The background worker queue is unavailable. Is Redis running?" },
    });
    throw error;
  }

  return { syncRun, enqueued: true };
}
