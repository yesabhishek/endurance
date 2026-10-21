import { beforeEach, describe, expect, it, vi } from "vitest";
import { processSyncJob } from "./worker";

const mocks = vi.hoisted(() => {
  class KiteReconnectRequired extends Error {
    constructor() {
      super("Your Kite session has expired.");
    }
  }
  return {
    db: { syncRun: { findUnique: vi.fn(), update: vi.fn() } },
    gmail: vi.fn(),
    kite: vi.fn(),
    createNotification: vi.fn(),
    KiteReconnectRequired,
  };
});

vi.mock("@/lib/db", () => ({ tenantDb: () => mocks.db }));
vi.mock("@/lib/gmail/sync", () => ({ syncGmailFinancialEmails: mocks.gmail }));
vi.mock("@/lib/kite/sync", () => ({ syncKitePortfolio: mocks.kite, KiteReconnectRequired: mocks.KiteReconnectRequired }));
vi.mock("@/lib/notifications", () => ({ createSyncNotification: mocks.createNotification }));

const job = (data: Record<string, unknown>, attemptsMade = 0) => ({ data, opts: { attempts: 2 }, attemptsMade }) as never;

describe("processSyncJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.db.syncRun.findUnique.mockResolvedValue(null);
  });

  it("runs the Gmail sync for the job's user and notifies them", async () => {
    const syncRun = { id: "sync-1", source: "GMAIL", status: "SUCCESS" };
    mocks.gmail.mockResolvedValue(syncRun);

    await expect(processSyncJob(job({ userId: "user-1", source: "GMAIL", syncRunId: "sync-1" }))).resolves.toEqual({ status: "SUCCESS" });

    expect(mocks.gmail).toHaveBeenCalledWith({ userId: "user-1", syncRunId: "sync-1" });
    expect(mocks.createNotification).toHaveBeenCalledWith("user-1", syncRun);
  });

  it("runs the Kite sync for the job's user", async () => {
    const syncRun = { id: "sync-2", source: "KITE", status: "SUCCESS" };
    mocks.kite.mockResolvedValue(syncRun);

    await processSyncJob(job({ userId: "user-2", source: "KITE", syncRunId: "sync-2" }));

    expect(mocks.kite).toHaveBeenCalledWith({ userId: "user-2", syncRunId: "sync-2" });
  });

  it("rejects jobs without a user id", async () => {
    await expect(processSyncJob(job({ source: "KITE", syncRunId: "sync-x" }))).rejects.toThrow("missing its user");
    expect(mocks.kite).not.toHaveBeenCalled();
  });

  it("notifies on failure only after the final attempt", async () => {
    const failedRun = { id: "sync-3", source: "GMAIL", status: "FAILED", error: "The update could not finish." };
    mocks.gmail.mockRejectedValue(new Error("Gmail unavailable"));
    mocks.db.syncRun.update.mockResolvedValue(failedRun);

    await expect(processSyncJob(job({ userId: "user-1", source: "GMAIL", syncRunId: "sync-3" }, 0))).rejects.toThrow("Gmail unavailable");
    expect(mocks.createNotification).not.toHaveBeenCalled();

    await expect(processSyncJob(job({ userId: "user-1", source: "GMAIL", syncRunId: "sync-3" }, 1))).rejects.toThrow("Gmail unavailable");
    expect(mocks.createNotification).toHaveBeenCalledWith("user-1", failedRun);
  });

  it("does not retry an expired Kite login", async () => {
    const failedRun = { id: "sync-4", source: "KITE", status: "FAILED", error: "Your Kite session has expired." };
    mocks.kite.mockRejectedValue(new mocks.KiteReconnectRequired());
    mocks.db.syncRun.update.mockResolvedValue(failedRun);

    await expect(processSyncJob(job({ userId: "user-1", source: "KITE", syncRunId: "sync-4" }, 0))).resolves.toEqual({ status: "FAILED" });
    expect(mocks.createNotification).toHaveBeenCalledWith("user-1", failedRun);
  });
});
