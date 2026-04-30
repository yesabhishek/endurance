import type { ConnectedAccount, SyncCursor } from "@prisma/client";
import { format, subDays, subMonths } from "date-fns";
import { getDb } from "@/lib/db";
import type { DbClient } from "@/lib/db";
import { parseFinancialEmail } from "@/lib/finance/email-parser";
import { getAuthorizedGmailClient } from "./auth";

const FINANCE_QUERY_TERMS = [
  "credit card",
  "statement",
  "google pay",
  "gpay",
  "upi",
  "subscription",
  "autopay",
  "invoice",
  "zerodha",
  "coin",
  "mutual fund",
  "amc",
  "gold",
  "sgb",
  "bill",
];

type GmailHeader = {
  name?: string | null;
  value?: string | null;
};

type GmailSyncOptions = {
  syncRunId?: string;
  limit?: number;
  months?: number;
};

type GmailClient = Awaited<ReturnType<typeof getAuthorizedGmailClient>>["gmail"];

type GmailMessageRef = {
  id?: string | null;
};

type ProcessedGmailMessage = {
  id: string;
  sentAt: Date;
  historyId: string | null;
};

type GmailSyncPlan = {
  cursor: SyncCursor | null;
  cursorType: "GMAIL_BACKFILL" | "GMAIL_HISTORY" | "GMAIL_TIMESTAMP";
  refs: GmailMessageRef[];
  latestHistoryId: string | null;
};

const GMAIL_CURSOR_OVERLAP_DAYS = 2;

export async function syncGmailFinancialEmails(options: GmailSyncOptions = {}) {
  const db = getDb();
  const config = getSpendingSyncConfig(options);
  const syncRun = options.syncRunId
    ? await db.syncRun.update({
        where: { id: options.syncRunId },
        data: {
          status: "RUNNING",
          finishedAt: null,
          error: null,
        },
      })
    : await db.syncRun.create({
        data: { source: "GMAIL", status: "RUNNING" },
      });

  try {
    const { account, gmail } = await getAuthorizedGmailClient();
    await db.syncRun.update({
      where: { id: syncRun.id },
      data: { connectedAccountId: account.id },
    });

    const plan = await buildGmailSyncPlan(db, gmail, account, config);
    const messages = await filterNewGmailMessageRefs(db, plan.refs);

    let inserted = 0;
    const updated = 0;
    const processed: ProcessedGmailMessage[] = [];

    for (const [index, message] of messages.entries()) {
      if (!message.id) continue;
      const result = await processGmailMessage(db, gmail, account, message.id);
      processed.push(result);
      inserted += 1;

      if ((index + 1) % 10 === 0 || index === messages.length - 1) {
        await db.syncRun.update({
          where: { id: syncRun.id },
          data: {
            scanned: index + 1,
            inserted,
            updated,
          },
        });
      }
    }

    await updateGmailSyncCursor(db, account, plan, processed);

    return await db.syncRun.update({
      where: { id: syncRun.id },
      data: {
        status: "SUCCESS",
        finishedAt: new Date(),
        scanned: messages.length,
        inserted,
        updated,
      },
    });
  } catch (error) {
    const failedRun = await db.syncRun.update({
      where: { id: syncRun.id },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        error: error instanceof Error ? error.message : "Unknown Spending Data update error",
      },
    });
    throw new Error(failedRun.error ?? "Unknown Spending Data update error");
  }
}

async function buildGmailSyncPlan(
  db: DbClient,
  gmail: GmailClient,
  account: ConnectedAccount,
  config: ReturnType<typeof getSpendingSyncConfig>,
): Promise<GmailSyncPlan> {
  const cursor = await db.syncCursor.findUnique({
    where: {
      source_connectedAccountId: {
        source: "GMAIL",
        connectedAccountId: account.id,
      },
    },
  });

  if (cursor?.lastHistoryId) {
    try {
      const history = await listGmailHistoryMessageRefs(gmail, cursor.lastHistoryId, config.limit);
      return {
        cursor,
        cursorType: "GMAIL_HISTORY",
        refs: history.refs,
        latestHistoryId: history.latestHistoryId,
      };
    } catch {
      const refs = await listGmailSearchMessageRefs(gmail, fallbackQuery(cursor, config), config.limit);
      return {
        cursor,
        cursorType: "GMAIL_TIMESTAMP",
        refs,
        latestHistoryId: null,
      };
    }
  }

  if (cursor?.lastMessageAt) {
    return {
      cursor,
      cursorType: "GMAIL_TIMESTAMP",
      refs: await listGmailSearchMessageRefs(gmail, fallbackQuery(cursor, config), config.limit),
      latestHistoryId: null,
    };
  }

  const after = format(subMonths(new Date(), config.months), "yyyy/MM/dd");
  return {
    cursor,
    cursorType: "GMAIL_BACKFILL",
    refs: await listGmailSearchMessageRefs(gmail, financeQueryAfter(after), config.limit),
    latestHistoryId: null,
  };
}

async function listGmailSearchMessageRefs(gmail: GmailClient, q: string, limit: number) {
  const messages: GmailMessageRef[] = [];
  let pageToken: string | undefined;
  do {
    const list = await gmail.users.messages.list({
      userId: "me",
      q,
      maxResults: Math.min(500, limit - messages.length),
      pageToken,
    });
    messages.push(...((list.data.messages ?? []) as GmailMessageRef[]));
    pageToken = list.data.nextPageToken ?? undefined;
  } while (pageToken && messages.length < limit);
  return messages;
}

async function listGmailHistoryMessageRefs(gmail: GmailClient, startHistoryId: string, limit: number) {
  const messages: GmailMessageRef[] = [];
  let latestHistoryId: string | null = null;
  let pageToken: string | undefined;

  do {
    const page = await gmail.users.history.list({
      userId: "me",
      startHistoryId,
      historyTypes: ["messageAdded"],
      maxResults: Math.min(500, limit - messages.length),
      pageToken,
    });

    latestHistoryId = page.data.historyId ?? latestHistoryId;
    for (const item of page.data.history ?? []) {
      for (const added of item.messagesAdded ?? []) {
        if (added.message?.id) messages.push({ id: added.message.id });
      }
      for (const message of item.messages ?? []) {
        if (message.id) messages.push({ id: message.id });
      }
    }
    pageToken = page.data.nextPageToken ?? undefined;
  } while (pageToken && messages.length < limit);

  return {
    refs: dedupeMessageRefs(messages).slice(0, limit),
    latestHistoryId,
  };
}

async function filterNewGmailMessageRefs(db: DbClient, refs: GmailMessageRef[]) {
  const uniqueRefs = dedupeMessageRefs(refs);
  const ids = uniqueRefs.map((message) => message.id).filter((id): id is string => Boolean(id));
  if (!ids.length) return [];

  const existing = await db.emailSource.findMany({
    where: { gmailMessageId: { in: ids } },
    select: { gmailMessageId: true },
  });
  const existingIds = new Set(existing.map((item) => item.gmailMessageId));
  return uniqueRefs.filter((message) => message.id && !existingIds.has(message.id));
}

async function processGmailMessage(
  db: DbClient,
  gmail: GmailClient,
  account: ConnectedAccount,
  messageId: string,
): Promise<ProcessedGmailMessage> {
  const detail = await gmail.users.messages.get({
    userId: "me",
    id: messageId,
    format: "metadata",
    metadataHeaders: ["From", "Subject", "Date"],
  });

  const headers = detail.data.payload?.headers ?? [];
  const subject = header(headers, "Subject") ?? "(no subject)";
  const from = header(headers, "From");
  const sentAt = new Date(Number(detail.data.internalDate ?? Date.now()));
  const parsed = parseFinancialEmail({
    subject,
    snippet: detail.data.snippet,
    from,
    sentAt,
  });

  const emailSource = await db.emailSource.upsert({
    where: { gmailMessageId: messageId },
    update: {
      gmailThreadId: detail.data.threadId,
      accountEmail: account.accountEmail,
      sentAt,
      fromAddress: from,
      subject,
      snippet: detail.data.snippet,
      labelsJson: JSON.stringify(detail.data.labelIds ?? []),
    },
    create: {
      gmailMessageId: messageId,
      gmailThreadId: detail.data.threadId,
      accountEmail: account.accountEmail,
      sentAt,
      fromAddress: from,
      subject,
      snippet: detail.data.snippet,
      labelsJson: JSON.stringify(detail.data.labelIds ?? []),
    },
  });

  if (parsed) {
    await db.parsedFinancialEmail.deleteMany({
      where: { emailSourceId: emailSource.id },
    });
    await db.parsedFinancialEmail.create({
      data: {
        emailSourceId: emailSource.id,
        kind: parsed.kind,
        amount: parsed.amount,
        currency: parsed.currency,
        merchantName: parsed.merchantName,
        paymentInstrument: parsed.paymentInstrument,
        category: parsed.category,
        confidence: parsed.confidence,
        metadataJson: JSON.stringify(parsed.metadata),
      },
    });

    if (parsed.amount && parsed.amount > 0 && isParsedExpense(parsed.kind, parsed.category)) {
      const merchant = await db.merchant.upsert({
        where: { name: parsed.merchantName ?? "Unknown merchant" },
        update: {
          normalizedName: normalizeMerchant(parsed.merchantName),
          category: parsed.category,
        },
        create: {
          name: parsed.merchantName ?? "Unknown merchant",
          normalizedName: normalizeMerchant(parsed.merchantName),
          category: parsed.category,
        },
      });

      await db.transaction.upsert({
        where: { externalId: `${messageId}:${parsed.amount}` },
        update: {
          emailSourceId: emailSource.id,
          merchantId: merchant.id,
          amount: parsed.amount,
          transactionDate: sentAt,
          category: parsed.category,
          paymentInstrument: parsed.paymentInstrument,
          description: subject,
          confidence: parsed.confidence,
        },
        create: {
          externalId: `${messageId}:${parsed.amount}`,
          emailSourceId: emailSource.id,
          merchantId: merchant.id,
          amount: parsed.amount,
          transactionDate: sentAt,
          category: parsed.category,
          paymentInstrument: parsed.paymentInstrument,
          description: subject,
          confidence: parsed.confidence,
        },
      });

      if (parsed.kind === "SUBSCRIPTION" || parsed.kind === "BILL") {
        await db.recurringPayment.upsert({
          where: {
            merchantId_cadence: {
              merchantId: merchant.id,
              cadence: "monthly",
            },
          },
          update: {
            amount: parsed.amount,
            lastSeenAt: sentAt,
            status: "ACTIVE",
          },
          create: {
            merchantId: merchant.id,
            amount: parsed.amount,
            cadence: "monthly",
            lastSeenAt: sentAt,
            status: "ACTIVE",
          },
        });
      }
    }
  }

  return {
    id: messageId,
    sentAt,
    historyId: detail.data.historyId ?? null,
  };
}

async function updateGmailSyncCursor(
  db: DbClient,
  account: ConnectedAccount,
  plan: GmailSyncPlan,
  processed: ProcessedGmailMessage[],
) {
  const newest = newestProcessedMessage(processed);
  const lastHistoryId = newestHistoryId([
    plan.latestHistoryId,
    plan.cursor?.lastHistoryId ?? null,
    ...processed.map((message) => message.historyId),
  ]);
  const fallbackTimestamp = plan.cursor ? plan.cursor.lastMessageAt : new Date();
  const lastMessageAt = newest?.sentAt ?? fallbackTimestamp;
  const lastMessageId = newest?.id ?? plan.cursor?.lastMessageId ?? null;

  await db.syncCursor.upsert({
    where: {
      source_connectedAccountId: {
        source: "GMAIL",
        connectedAccountId: account.id,
      },
    },
    update: {
      cursorType: plan.cursorType,
      lastMessageAt,
      lastMessageId,
      lastHistoryId,
      metadataJson: JSON.stringify({
        strategy: plan.cursorType,
        processed: processed.length,
        updatedAt: new Date().toISOString(),
      }),
    },
    create: {
      source: "GMAIL",
      connectedAccountId: account.id,
      cursorType: plan.cursorType,
      lastMessageAt,
      lastMessageId,
      lastHistoryId,
      metadataJson: JSON.stringify({
        strategy: plan.cursorType,
        processed: processed.length,
        updatedAt: new Date().toISOString(),
      }),
    },
  });
}

function dedupeMessageRefs(refs: GmailMessageRef[]) {
  const seen = new Set<string>();
  const unique: GmailMessageRef[] = [];
  for (const ref of refs) {
    if (!ref.id || seen.has(ref.id)) continue;
    seen.add(ref.id);
    unique.push(ref);
  }
  return unique;
}

function newestProcessedMessage(messages: ProcessedGmailMessage[]) {
  return messages.reduce<ProcessedGmailMessage | null>((newest, message) => {
    if (!newest || message.sentAt > newest.sentAt) return message;
    return newest;
  }, null);
}

function newestHistoryId(values: Array<string | null | undefined>) {
  const numeric = values
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => {
      const left = BigInt(a);
      const right = BigInt(b);
      if (left === right) return 0;
      return left > right ? -1 : 1;
    });
  return numeric[0] ?? null;
}

function financeQueryAfter(after: string) {
  return `after:${after} (${FINANCE_QUERY_TERMS.map((term) => `"${term}"`).join(" OR ")})`;
}

function fallbackQuery(cursor: SyncCursor, config: ReturnType<typeof getSpendingSyncConfig>) {
  const lastMessageAt = cursor.lastMessageAt ?? subMonths(new Date(), config.months);
  return financeQueryAfter(format(subDays(lastMessageAt, GMAIL_CURSOR_OVERLAP_DAYS), "yyyy/MM/dd"));
}

function header(headers: GmailHeader[], name: string) {
  return headers.find((item) => item.name?.toLowerCase() === name.toLowerCase())?.value ?? null;
}

function normalizeMerchant(name: string | null) {
  return (name ?? "Unknown merchant").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function isParsedExpense(kind: string, category: string | null) {
  if (kind === "BROKER_STATEMENT" || kind === "GOLD" || kind === "CREDIT_CARD_BILL") return false;
  return category !== "Investments" && category !== "Gold";
}

export function getSpendingSyncConfig(options: GmailSyncOptions = {}) {
  return {
    months: positiveInteger(options.months ?? process.env.GMAIL_SYNC_MONTHS, 48),
    limit: positiveInteger(options.limit ?? process.env.GMAIL_SYNC_LIMIT, 500),
  };
}

function positiveInteger(value: number | string | undefined, fallback: number) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}
