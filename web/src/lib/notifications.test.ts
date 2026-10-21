import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TenantDb } from "@/lib/db";
import { createSyncNotification, describeSyncRun, listNotifications, markNotificationsRead } from "./notifications";

const mocks = vi.hoisted(() => ({
  db: {
    notification: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      updateMany: vi.fn(),
    },
    syncRun: { findMany: vi.fn() },
  },
  tenantUserIds: [] as string[],
}));

vi.mock("@/lib/db", () => ({
  tenantDb: (userId: string) => {
    mocks.tenantUserIds.push(userId);
    return mocks.db;
  },
}));

const db = mocks.db as unknown as TenantDb;

describe("notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.tenantUserIds.length = 0;
  });

  it("writes a success notification through the user's scoped client", async () => {
    mocks.db.notification.create.mockResolvedValue({ id: "n-1" });

    await createSyncNotification("user-1", { id: "sync-1", source: "KITE", status: "SUCCESS", scanned: 10, inserted: 3, updated: 7, error: null });

    expect(mocks.tenantUserIds).toEqual(["user-1"]);
    expect(mocks.db.notification.create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        title: "Portfolio updated",
        body: "Checked 10 items: 3 new, 7 refreshed.",
        source: "KITE",
        syncRunId: "sync-1",
        status: "UNREAD",
      },
    });
  });

  it("shows the run's own error text on failure", () => {
    const text = describeSyncRun({ id: "s", source: "KITE", status: "FAILED", scanned: 0, inserted: 0, updated: 0, error: "Your Kite session has expired." });
    expect(text).toEqual({ title: "Portfolio update failed", body: "Your Kite session has expired." });
  });

  it("lists notifications with the unread count and active syncs", async () => {
    mocks.db.notification.findMany.mockResolvedValue([{ id: "n-1" }]);
    mocks.db.notification.count.mockResolvedValue(1);
    mocks.db.syncRun.findMany.mockResolvedValue([]);

    await expect(listNotifications(db)).resolves.toEqual({ notifications: [{ id: "n-1" }], unreadCount: 1, activeSyncs: [] });
  });

  it("marks one notification read with updateMany, so a foreign id matches nothing", async () => {
    mocks.db.notification.findMany.mockResolvedValue([]);
    mocks.db.notification.count.mockResolvedValue(0);
    mocks.db.syncRun.findMany.mockResolvedValue([]);

    await markNotificationsRead(db, { id: "n-9" });

    expect(mocks.db.notification.updateMany).toHaveBeenCalledWith({ where: { id: "n-9" }, data: expect.objectContaining({ status: "READ" }) });
  });
});
