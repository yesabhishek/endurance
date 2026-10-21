import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetEnvCache } from "@/lib/env";
import { getSpendingSyncConfig, syncGmailFinancialEmails } from "./sync";

const mocks = vi.hoisted(() => {
  const db = {
    syncRun: {
      create: vi.fn(),
      update: vi.fn(),
    },
    syncCursor: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    emailSource: {
      findMany: vi.fn(),
      upsert: vi.fn(),
    },
    parsedFinancialEmail: {
      deleteMany: vi.fn(),
      create: vi.fn(),
    },
    merchant: {
      upsert: vi.fn(),
    },
    transaction: {
      upsert: vi.fn(),
    },
    recurringPayment: {
      upsert: vi.fn(),
    },
  };

  const gmail = {
    users: {
      messages: {
        list: vi.fn(),
        get: vi.fn(),
      },
      history: {
        list: vi.fn(),
      },
    },
  };

  return {
    db,
    gmail,
    account: {
      id: "account-1",
      provider: "GMAIL",
      externalId: "person@example.com",
      displayName: "Person",
      status: "connected",
      scope: null,
      createdAt: new Date("2026-01-01T00:00:00Z"),
      updatedAt: new Date("2026-01-01T00:00:00Z"),
    },
  };
});

vi.mock("@/lib/db", () => ({
  tenantDb: () => mocks.db,
}));

vi.mock("./auth", () => ({
  getAuthorizedGmailClient: () => ({
    account: mocks.account,
    gmail: mocks.gmail,
  }),
}));

describe("spending sync config", () => {
  const originalMonths = process.env.GMAIL_SYNC_MONTHS;
  const originalLimit = process.env.GMAIL_SYNC_LIMIT;

  afterEach(() => {
    // Assigning undefined would store the string "undefined", so delete instead.
    if (originalMonths === undefined) delete process.env.GMAIL_SYNC_MONTHS;
    else process.env.GMAIL_SYNC_MONTHS = originalMonths;
    if (originalLimit === undefined) delete process.env.GMAIL_SYNC_LIMIT;
    else process.env.GMAIL_SYNC_LIMIT = originalLimit;
    resetEnvCache();
  });

  it("defaults to a 48 month spending data window", () => {
    delete process.env.GMAIL_SYNC_MONTHS;
    delete process.env.GMAIL_SYNC_LIMIT;
    resetEnvCache();

    expect(getSpendingSyncConfig()).toEqual({ months: 48, limit: 500 });
  });

  it("allows the spending data window to be overridden", () => {
    process.env.GMAIL_SYNC_MONTHS = "60";
    process.env.GMAIL_SYNC_LIMIT = "750";
    resetEnvCache();

    expect(getSpendingSyncConfig()).toEqual({ months: 60, limit: 750 });
  });
});

describe("syncGmailFinancialEmails incremental cursor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.db.syncRun.create.mockResolvedValue({ id: "sync-1", source: "GMAIL", status: "RUNNING" });
    mocks.db.syncRun.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: "sync-1",
      source: "GMAIL",
      ...data,
    }));
    mocks.db.emailSource.upsert.mockImplementation(async ({ create }: { create: Record<string, unknown> }) => ({
      id: `email-${create.gmailMessageId}`,
      ...create,
    }));
    mocks.db.parsedFinancialEmail.deleteMany.mockResolvedValue({ count: 0 });
    mocks.db.parsedFinancialEmail.create.mockResolvedValue({ id: "parsed-1" });
    mocks.db.merchant.upsert.mockResolvedValue({ id: "merchant-1", name: "Coffee Bar" });
    mocks.db.transaction.upsert.mockResolvedValue({ id: "transaction-1" });
    mocks.db.recurringPayment.upsert.mockResolvedValue({ id: "recurring-1" });
    mocks.db.syncCursor.upsert.mockResolvedValue({ id: "cursor-1" });
  });

  it("creates a cursor after the first backfill", async () => {
    mocks.db.syncCursor.findUnique.mockResolvedValue(null);
    mocks.db.emailSource.findMany.mockResolvedValue([]);
    mocks.gmail.users.messages.list.mockResolvedValue({ data: { messages: [{ id: "m1" }, { id: "m2" }] } });
    mocks.gmail.users.messages.get
      .mockResolvedValueOnce(messageDetail("m1", "2026-04-01T10:00:00Z", "101"))
      .mockResolvedValueOnce(messageDetail("m2", "2026-04-02T10:00:00Z", "102"));

    await syncGmailFinancialEmails({ userId: "user-1", syncRunId: "sync-1" });

    expect(mocks.gmail.users.messages.list).toHaveBeenCalledWith(expect.objectContaining({
      q: expect.stringContaining("after:"),
    }));
    expect(mocks.db.syncCursor.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        userId: "user-1",
        source: "GMAIL",
        connectedAccountId: "account-1",
        cursorType: "GMAIL_BACKFILL",
        lastMessageId: "m2",
        lastHistoryId: "102",
      }),
    }));
  });

  it("uses Gmail history and processes only new message IDs on later syncs", async () => {
    mocks.db.syncCursor.findUnique.mockResolvedValue(cursor({ lastHistoryId: "100" }));
    mocks.gmail.users.history.list.mockResolvedValue({
      data: {
        historyId: "105",
        history: [
          {
            messagesAdded: [
              { message: { id: "old-message" } },
              { message: { id: "new-message" } },
            ],
          },
        ],
      },
    });
    mocks.db.emailSource.findMany.mockResolvedValue([{ gmailMessageId: "old-message" }]);
    mocks.gmail.users.messages.get.mockResolvedValue(messageDetail("new-message", "2026-04-03T10:00:00Z", "105"));

    await syncGmailFinancialEmails({ userId: "user-1", syncRunId: "sync-1" });

    expect(mocks.gmail.users.history.list).toHaveBeenCalledWith(expect.objectContaining({
      startHistoryId: "100",
      historyTypes: ["messageAdded"],
    }));
    expect(mocks.gmail.users.messages.list).not.toHaveBeenCalled();
    expect(mocks.gmail.users.messages.get).toHaveBeenCalledTimes(1);
    expect(mocks.gmail.users.messages.get).toHaveBeenCalledWith(expect.objectContaining({ id: "new-message" }));
    expect(mocks.db.syncCursor.upsert).toHaveBeenCalledWith(expect.objectContaining({
      update: expect.objectContaining({
        cursorType: "GMAIL_HISTORY",
        lastMessageId: "new-message",
        lastHistoryId: "105",
      }),
    }));
  });

  it("skips existing message IDs before fetching metadata", async () => {
    mocks.db.syncCursor.findUnique.mockResolvedValue(null);
    mocks.gmail.users.messages.list.mockResolvedValue({ data: { messages: [{ id: "existing" }] } });
    mocks.db.emailSource.findMany.mockResolvedValue([{ gmailMessageId: "existing" }]);

    await syncGmailFinancialEmails({ userId: "user-1", syncRunId: "sync-1" });

    expect(mocks.gmail.users.messages.get).not.toHaveBeenCalled();
    expect(mocks.db.syncRun.update).toHaveBeenLastCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: "SUCCESS",
        scanned: 0,
        inserted: 0,
        updated: 0,
      }),
    }));
  });

  it("does not advance the cursor when message processing fails", async () => {
    mocks.db.syncCursor.findUnique.mockResolvedValue(cursor({ lastHistoryId: "100" }));
    mocks.gmail.users.history.list.mockResolvedValue({
      data: { historyId: "105", history: [{ messagesAdded: [{ message: { id: "new-message" } }] }] },
    });
    mocks.db.emailSource.findMany.mockResolvedValue([]);
    mocks.gmail.users.messages.get.mockRejectedValue(new Error("metadata unavailable"));

    await expect(syncGmailFinancialEmails({ userId: "user-1", syncRunId: "sync-1" })).rejects.toThrow("Spending data could not be updated");

    expect(mocks.db.syncCursor.upsert).not.toHaveBeenCalled();
  });

  it("falls back to timestamp search when Gmail history is unavailable", async () => {
    mocks.db.syncCursor.findUnique.mockResolvedValue(cursor({
      lastHistoryId: "100",
      lastMessageAt: new Date("2026-04-20T10:00:00Z"),
    }));
    mocks.gmail.users.history.list.mockRejectedValue(new Error("history expired"));
    mocks.gmail.users.messages.list.mockResolvedValue({ data: { messages: [{ id: "old" }, { id: "new" }] } });
    mocks.db.emailSource.findMany.mockResolvedValue([{ gmailMessageId: "old" }]);
    mocks.gmail.users.messages.get.mockResolvedValue(messageDetail("new", "2026-04-21T10:00:00Z", "110"));

    await syncGmailFinancialEmails({ userId: "user-1", syncRunId: "sync-1" });

    expect(mocks.gmail.users.messages.list).toHaveBeenCalledWith(expect.objectContaining({
      q: expect.stringContaining("after:2026/04/18"),
    }));
    expect(mocks.gmail.users.messages.get).toHaveBeenCalledTimes(1);
    expect(mocks.db.syncCursor.upsert).toHaveBeenCalledWith(expect.objectContaining({
      update: expect.objectContaining({
        cursorType: "GMAIL_TIMESTAMP",
        lastMessageId: "new",
        lastHistoryId: "110",
      }),
    }));
  });
});

function messageDetail(id: string, isoDate: string, historyId: string) {
  return {
    data: {
      id,
      threadId: `thread-${id}`,
      historyId,
      internalDate: String(new Date(isoDate).getTime()),
      labelIds: ["INBOX"],
      snippet: "You paid INR 500 to COFFEE BAR using UPI.",
      payload: {
        headers: [
          { name: "Subject", value: "You paid using UPI" },
          { name: "From", value: "Payments <payments@example.com>" },
          { name: "Date", value: isoDate },
        ],
      },
    },
  };
}

function cursor(overrides: Record<string, unknown> = {}) {
  return {
    id: "cursor-1",
    source: "GMAIL",
    connectedAccountId: "account-1",
    cursorType: "GMAIL_HISTORY",
    lastMessageAt: new Date("2026-04-01T10:00:00Z"),
    lastMessageId: "old-message",
    lastHistoryId: "100",
    metadataJson: null,
    createdAt: new Date("2026-04-01T10:00:00Z"),
    updatedAt: new Date("2026-04-01T10:00:00Z"),
    ...overrides,
  };
}
