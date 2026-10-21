import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TenantDb } from "@/lib/db";
import { enqueueSyncRun } from "./enqueue";

const mocks = vi.hoisted(() => ({
  db: {
    syncRun: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
  queue: { add: vi.fn() },
}));

vi.mock("./queue", () => ({
  getSyncQueue: () => mocks.queue,
}));

const db = mocks.db as unknown as TenantDb;

describe("enqueueSyncRun", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns this user's active run without adding a duplicate job", async () => {
    const active = { id: "sync-active", source: "GMAIL", status: "RUNNING", startedAt: new Date() };
    mocks.db.syncRun.findFirst.mockResolvedValue(active);

    const result = await enqueueSyncRun(db, "user-1", "GMAIL");

    expect(mocks.db.syncRun.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId: "user-1", source: "GMAIL" }) }),
    );
    expect(result).toEqual({ syncRun: active, enqueued: false });
    expect(mocks.queue.add).not.toHaveBeenCalled();
  });

  it("treats a run stuck for 15 minutes as dead and queues a new one", async () => {
    const stale = { id: "sync-old", source: "KITE", status: "RUNNING", startedAt: new Date(Date.now() - 20 * 60 * 1000) };
    mocks.db.syncRun.findFirst.mockResolvedValue(stale);
    mocks.db.syncRun.create.mockResolvedValue({ id: "sync-new", source: "KITE", status: "QUEUED" });
    mocks.queue.add.mockResolvedValue({ id: "sync-new" });

    const result = await enqueueSyncRun(db, "user-1", "KITE");

    expect(mocks.db.syncRun.update).toHaveBeenCalledWith({ where: { id: "sync-old" }, data: expect.objectContaining({ status: "FAILED" }) });
    expect(result.enqueued).toBe(true);
  });

  it("creates a queued run and a job that carries only ids", async () => {
    const syncRun = { id: "sync-1", source: "KITE", status: "QUEUED" };
    mocks.db.syncRun.findFirst.mockResolvedValue(null);
    mocks.db.syncRun.create.mockResolvedValue(syncRun);
    mocks.queue.add.mockResolvedValue({ id: syncRun.id });

    const result = await enqueueSyncRun(db, "user-1", "KITE");

    expect(mocks.db.syncRun.create).toHaveBeenCalledWith({ data: { userId: "user-1", source: "KITE", status: "QUEUED" } });
    expect(mocks.queue.add).toHaveBeenCalledWith("sync", { userId: "user-1", source: "KITE", syncRunId: "sync-1" }, { jobId: "sync-1" });
    expect(result).toEqual({ syncRun, enqueued: true });
  });

  it("marks the run failed with a readable message when the queue is down", async () => {
    mocks.db.syncRun.findFirst.mockResolvedValue(null);
    mocks.db.syncRun.create.mockResolvedValue({ id: "sync-2", source: "GMAIL", status: "QUEUED" });
    mocks.queue.add.mockRejectedValue(new Error("connect ECONNREFUSED"));

    await expect(enqueueSyncRun(db, "user-1", "GMAIL")).rejects.toThrow("ECONNREFUSED");
    expect(mocks.db.syncRun.update).toHaveBeenCalledWith({
      where: { id: "sync-2" },
      data: expect.objectContaining({ status: "FAILED", error: expect.stringContaining("Redis") }),
    });
  });
});
