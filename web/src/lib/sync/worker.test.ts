import { beforeEach, describe, expect, it, vi } from "vitest";
import { processSyncJob } from "./worker";

const mocks = vi.hoisted(() => ({
  db: {
    syncRun: {
      update: vi.fn(),
    },
  },
  gmail: vi.fn(),
  kite: vi.fn(),
  createNotification: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  getDb: () => mocks.db,
}));

vi.mock("@/lib/gmail/sync", () => ({
  syncGmailFinancialEmails: mocks.gmail,
}));

vi.mock("@/lib/kite/sync", () => ({
  syncKitePortfolio: mocks.kite,
}));

vi.mock("@/lib/notifications", () => ({
  createSyncNotification: mocks.createNotification,
}));

describe("processSyncJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("runs Gmail sync and creates a success notification", async () => {
    const syncRun = { id: "sync-1", source: "GMAIL", status: "SUCCESS" };
    mocks.gmail.mockResolvedValue(syncRun);

    await expect(
      processSyncJob({
        data: { source: "GMAIL", syncRunId: "sync-1" },
        opts: { attempts: 2 },
        attemptsMade: 0,
      } as never),
    ).resolves.toBe(syncRun);

    expect(mocks.gmail).toHaveBeenCalledWith({ syncRunId: "sync-1" });
    expect(mocks.createNotification).toHaveBeenCalledWith(syncRun);
  });

  it("runs Kite sync and creates a success notification", async () => {
    const syncRun = { id: "sync-2", source: "KITE", status: "SUCCESS" };
    mocks.kite.mockResolvedValue(syncRun);

    await processSyncJob({
      data: { source: "KITE", syncRunId: "sync-2" },
      opts: { attempts: 2 },
      attemptsMade: 0,
    } as never);

    expect(mocks.kite).toHaveBeenCalledWith({ syncRunId: "sync-2" });
    expect(mocks.createNotification).toHaveBeenCalledWith(syncRun);
  });

  it("creates a failure notification only on the final attempt", async () => {
    const error = new Error("Gmail unavailable");
    const failedRun = { id: "sync-3", source: "GMAIL", status: "FAILED", error: error.message };
    mocks.gmail.mockRejectedValue(error);
    mocks.db.syncRun.update.mockResolvedValue(failedRun);

    await expect(
      processSyncJob({
        data: { source: "GMAIL", syncRunId: "sync-3" },
        opts: { attempts: 2 },
        attemptsMade: 0,
      } as never),
    ).rejects.toThrow("Gmail unavailable");

    expect(mocks.createNotification).not.toHaveBeenCalled();

    await expect(
      processSyncJob({
        data: { source: "GMAIL", syncRunId: "sync-3" },
        opts: { attempts: 2 },
        attemptsMade: 1,
      } as never),
    ).rejects.toThrow("Gmail unavailable");

    expect(mocks.db.syncRun.update).toHaveBeenCalledWith({
      where: { id: "sync-3" },
      data: expect.objectContaining({
        status: "FAILED",
        error: "Gmail unavailable",
      }),
    });
    expect(mocks.createNotification).toHaveBeenCalledWith(failedRun);
  });
});
