import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSyncNotification, listNotifications, markNotificationsRead } from "./notifications";

const mocks = vi.hoisted(() => ({
  db: {
      notification: {
        create: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      syncRun: {
        findMany: vi.fn(),
      },
  },
}));

vi.mock("@/lib/db", () => ({
  getDb: () => mocks.db,
}));

describe("notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a success notification for a sync run", async () => {
    mocks.db.notification.create.mockResolvedValue({ id: "notification-1" });

    await createSyncNotification({
      id: "sync-1",
      source: "GMAIL",
      status: "SUCCESS",
      scanned: 10,
      inserted: 3,
      updated: 7,
      error: null,
    });

    expect(mocks.db.notification.create).toHaveBeenCalledWith({
      data: {
        title: "Spending Data update completed",
        body: "Scanned 10, inserted 3, updated 7.",
        source: "GMAIL",
        syncRunId: "sync-1",
        status: "UNREAD",
      },
    });
  });

  it("creates a failure notification for a sync run", async () => {
    mocks.db.notification.create.mockResolvedValue({ id: "notification-2" });

    await createSyncNotification({
      id: "sync-2",
      source: "KITE",
      status: "FAILED",
      scanned: 0,
      inserted: 0,
      updated: 0,
      error: "Investment connector login required",
    });

    expect(mocks.db.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        title: "Investment Data update failed",
        body: "Investment Data could not be updated. Open Settings and reconnect this data source if needed.",
        source: "KITE",
      }),
    });
  });

  it("lists notifications with unread count", async () => {
    mocks.db.notification.findMany.mockResolvedValue([{ id: "notification-1" }]);
    mocks.db.notification.count.mockResolvedValue(1);
    mocks.db.syncRun.findMany.mockResolvedValue([{ id: "sync-1", status: "RUNNING" }]);

    await expect(listNotifications()).resolves.toEqual({
      notifications: [{ id: "notification-1" }],
      unreadCount: 1,
      activeSyncs: [{ id: "sync-1", status: "RUNNING" }],
    });
  });

  it("marks all unread notifications as read", async () => {
    mocks.db.notification.updateMany.mockResolvedValue({ count: 2 });
    mocks.db.notification.findMany.mockResolvedValue([]);
    mocks.db.notification.count.mockResolvedValue(0);

    await markNotificationsRead({ all: true });

    expect(mocks.db.notification.updateMany).toHaveBeenCalledWith({
      where: { status: "UNREAD" },
      data: expect.objectContaining({
        status: "READ",
        readAt: expect.any(Date),
      }),
    });
  });
});
