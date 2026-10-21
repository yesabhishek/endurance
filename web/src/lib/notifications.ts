import type { Notification, SyncRun } from "@prisma/client";
import { tenantDb, type TenantDb } from "@/lib/db";

type SyncRunForNotification = Pick<SyncRun, "id" | "source" | "status" | "scanned" | "inserted" | "updated" | "error">;

export function describeSyncRun(syncRun: SyncRunForNotification) {
  const success = syncRun.status === "SUCCESS";
  const label = syncRun.source === "GMAIL" ? "Spending data" : "Portfolio";
  return {
    title: `${label} ${success ? "updated" : "update failed"}`,
    body: success
      ? `Checked ${syncRun.scanned} items: ${syncRun.inserted} new, ${syncRun.updated} refreshed.`
      : syncRun.error ?? `${label} could not be updated. Open Settings to reconnect if needed.`,
  };
}

export async function createSyncNotification(userId: string, syncRun: SyncRunForNotification) {
  const { title, body } = describeSyncRun(syncRun);
  return tenantDb(userId).notification.create({
    data: { userId, title, body, source: syncRun.source, syncRunId: syncRun.id, status: "UNREAD" },
  });
}

export async function listNotifications(db: TenantDb, limit = 10) {
  const [notifications, unreadCount, activeSyncs] = await Promise.all([
    db.notification.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      select: { id: true, title: true, body: true, source: true, status: true, createdAt: true, readAt: true },
    }),
    db.notification.count({ where: { status: "UNREAD" } }),
    db.syncRun.findMany({
      where: { status: { in: ["QUEUED", "RUNNING"] } },
      orderBy: { startedAt: "desc" },
      select: { id: true, source: true, status: true, scanned: true, inserted: true, updated: true, startedAt: true },
    }),
  ]);
  return { notifications, unreadCount, activeSyncs };
}

export async function markNotificationsRead(db: TenantDb, options: { id?: string; all?: boolean }) {
  const data = { status: "READ" as const, readAt: new Date() };
  if (options.all) {
    await db.notification.updateMany({ where: { status: "UNREAD" }, data });
  } else if (options.id) {
    await db.notification.updateMany({ where: { id: options.id }, data });
  }
  return listNotifications(db);
}

export type NotificationPayload = Pick<Notification, "id" | "title" | "body" | "source" | "status" | "createdAt" | "readAt">;
