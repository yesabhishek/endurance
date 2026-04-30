import type { Notification, NotificationStatus, SyncRun } from "@prisma/client";
import { getDb } from "@/lib/db";

type SyncRunForNotification = Pick<SyncRun, "id" | "source" | "status" | "scanned" | "inserted" | "updated" | "error">;

export async function createSyncNotification(syncRun: SyncRunForNotification) {
  const success = syncRun.status === "SUCCESS";
  const sourceLabel = syncRun.source === "GMAIL" ? "Spending Data" : "Investment Data";

  return getDb().notification.create({
    data: {
      title: `${sourceLabel} update ${success ? "completed" : "failed"}`,
      body: success
        ? `Scanned ${syncRun.scanned}, inserted ${syncRun.inserted}, updated ${syncRun.updated}.`
        : `${sourceLabel} could not be updated. Open Settings and reconnect this data source if needed.`,
      source: syncRun.source,
      syncRunId: syncRun.id,
      status: "UNREAD",
    },
  });
}

export async function listNotifications(limit = 10) {
  const db = getDb();
  const [notifications, unreadCount, activeSyncs] = await Promise.all([
    db.notification.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    db.notification.count({
      where: { status: "UNREAD" },
    }),
    db.syncRun.findMany({
      where: { status: { in: ["QUEUED", "RUNNING"] } },
      orderBy: { startedAt: "desc" },
      select: {
        id: true,
        source: true,
        status: true,
        scanned: true,
        inserted: true,
        updated: true,
        startedAt: true,
      },
    }),
  ]);

  return {
    notifications,
    unreadCount,
    activeSyncs,
  };
}

export async function markNotificationsRead(options: { id?: string; all?: boolean }) {
  const db = getDb();
  const data = {
    status: "READ" as NotificationStatus,
    readAt: new Date(),
  };

  if (options.all) {
    await db.notification.updateMany({
      where: { status: "UNREAD" },
      data,
    });
  } else if (options.id) {
    await db.notification.update({
      where: { id: options.id },
      data,
    });
  }

  return listNotifications();
}

export type NotificationPayload = Pick<Notification, "id" | "title" | "body" | "source" | "status" | "createdAt" | "readAt">;
