import { beforeEach, describe, expect, it, vi } from "vitest";
import { enqueueSyncRun } from "./enqueue";

const mocks = vi.hoisted(() => {
  const db = {
    syncRun: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  };
  const queue = {
    add: vi.fn(),
    close: vi.fn(),
  };
  return { db, queue };
});

vi.mock("@/lib/db", () => ({
  getDb: () => mocks.db,
}));

vi.mock("./queue", () => ({
  createSyncQueue: () => mocks.queue,
}));

describe("enqueueSyncRun", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.queue.close.mockResolvedValue(undefined);
  });

  it("returns the active run without adding a duplicate job", async () => {
    const active = { id: "sync-active", source: "GMAIL", status: "RUNNING" };
    mocks.db.syncRun.findFirst.mockResolvedValue(active);

    const result = await enqueueSyncRun("GMAIL");

    expect(result).toEqual({ syncRun: active, enqueued: false });
    expect(mocks.db.syncRun.create).not.toHaveBeenCalled();
    expect(mocks.queue.add).not.toHaveBeenCalled();
  });

  it("creates a queued sync run and adds a BullMQ job", async () => {
    const syncRun = { id: "sync-1", source: "KITE", status: "QUEUED" };
    mocks.db.syncRun.findFirst.mockResolvedValue(null);
    mocks.db.syncRun.create.mockResolvedValue(syncRun);
    mocks.queue.add.mockResolvedValue({ id: syncRun.id });

    const result = await enqueueSyncRun("KITE");

    expect(mocks.db.syncRun.create).toHaveBeenCalledWith({
      data: { source: "KITE", status: "QUEUED" },
    });
    expect(mocks.queue.add).toHaveBeenCalledWith(
      "sync",
      { source: "KITE", syncRunId: "sync-1" },
      { jobId: "sync-1" },
    );
    expect(mocks.queue.close).toHaveBeenCalled();
    expect(result).toEqual({ syncRun, enqueued: true });
  });

  it("marks the sync run failed when enqueueing fails", async () => {
    const error = new Error("Redis unavailable");
    mocks.db.syncRun.findFirst.mockResolvedValue(null);
    mocks.db.syncRun.create.mockResolvedValue({ id: "sync-2", source: "GMAIL", status: "QUEUED" });
    mocks.queue.add.mockRejectedValue(error);

    await expect(enqueueSyncRun("GMAIL")).rejects.toThrow("Redis unavailable");
    expect(mocks.db.syncRun.update).toHaveBeenCalledWith({
      where: { id: "sync-2" },
      data: expect.objectContaining({
        status: "FAILED",
        error: "Redis unavailable",
      }),
    });
  });
});
