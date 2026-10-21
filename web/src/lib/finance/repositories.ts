import type { EmailKind, Holding, InvestmentAccount, InvestmentSnapshot, Merchant, Transaction } from "@prisma/client";
import {
  eachDayOfInterval,
  endOfDay,
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from "date-fns";
import type { TenantDb } from "@/lib/db";

export type ExpenseRangePreset = "week" | "month" | "year" | "custom";

export type ExpenseRangeInput = {
  preset?: string | string[];
  from?: string | string[];
  to?: string | string[];
};

export type ExpenseRange = {
  preset: ExpenseRangePreset;
  from: Date;
  to: Date;
};

type TransactionWithMerchant = Transaction & {
  merchant?: Merchant | null;
};

type TransactionWithDetails = Transaction & {
  merchant?: Merchant | null;
  emailSource?: {
    accountEmail: string | null;
    fromAddress: string | null;
    fromName: string | null;
    subject: string;
    sentAt: Date;
    snippet: string | null;
    parsed?: Array<{ kind: EmailKind }>;
  } | null;
};

type CreditCardEmailSignal = {
  id: string;
  amount: unknown;
  merchantName: string | null;
  paymentInstrument: string | null;
  confidence: number;
  emailSource: {
    sentAt: Date;
    fromAddress: string | null;
    fromName: string | null;
    subject: string;
    snippet: string | null;
  };
};

export type CreditCardSummary = {
  id: string;
  issuer: string;
  displayName: string;
  last4: string | null;
  latestAmount: number | null;
  latestSeenAt: Date;
  sourceCount: number;
  confidence: number;
};

type HoldingWithAccount = Holding & {
  account?: InvestmentAccount | null;
};

type SnapshotWithHolding = InvestmentSnapshot & {
  holding: Holding;
};

export async function getFinancialOverview(db: TenantDb) {
  const range = parseExpenseRange({ preset: "month" });

  const [rawTransactions, recurring, lastSyncs, accounts] = await Promise.all([
    db.transaction.findMany({
      where: { transactionDate: { gte: range.from, lte: range.to } },
      include: { merchant: true, emailSource: { include: { parsed: { select: { kind: true } } } } },
      orderBy: { transactionDate: "desc" },
      take: 1000,
    }),
    db.recurringPayment.findMany({
      include: { merchant: true },
      orderBy: { lastSeenAt: "desc" },
      take: 8,
    }),
    db.syncRun.findMany({ orderBy: { startedAt: "desc" }, take: 6 }),
    db.connectedAccount.findMany({ select: { provider: true, status: true } }),
  ]);

  const transactions = rawTransactions.filter(isExpenseTransaction);
  const expenseTotal = transactions.reduce((sum, item) => sum + Number(item.amount), 0);
  const recurringTotal = recurring.reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
  const hasSpendingData = accounts.some((account) => account.provider === "GMAIL" && account.status === "CONNECTED");

  return {
    expenseTotal,
    recurringTotal,
    transactions: transactions.slice(0, 10),
    recurring,
    lastSyncs,
    hasSpendingData,
  };
}

export async function getExpensesData(db: TenantDb, input: ExpenseRangeInput = {}) {
  const range = parseExpenseRange(input);
  const [rawTransactions, merchants, recurring, cardEmailSignals] = await Promise.all([
    db.transaction.findMany({
      include: { merchant: true, emailSource: { include: { parsed: { select: { kind: true } } } } },
      where: { transactionDate: { gte: range.from, lte: range.to } },
      orderBy: { transactionDate: "desc" },
      take: 1000,
    }),
    db.merchant.findMany({
      include: { _count: { select: { transactions: true } } },
      orderBy: { updatedAt: "desc" },
      take: 40,
    }),
    db.recurringPayment.findMany({
      include: { merchant: true },
      orderBy: { lastSeenAt: "desc" },
      take: 40,
    }),
    db.parsedFinancialEmail.findMany({
      include: { emailSource: true },
      where: { kind: "CREDIT_CARD_BILL" },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);
  const transactions = rawTransactions.filter(isExpenseTransaction);
  const analytics = buildExpenseAnalytics(transactions, recurring, range);
  const creditCards = detectCreditCards(cardEmailSignals, rawTransactions);

  return { transactions, merchants, recurring, creditCards, range, analytics };
}

export function parseExpenseRange(input: ExpenseRangeInput = {}, now = new Date()): ExpenseRange {
  const preset = normalizePreset(firstValue(input.preset));
  const customFrom = parseDate(firstValue(input.from));
  const customTo = parseDate(firstValue(input.to));

  if (preset === "custom" && customFrom && customTo) {
    return {
      preset,
      from: startOfDay(customFrom),
      to: endOfDay(customTo),
    };
  }

  if (preset === "week") {
    return {
      preset,
      from: startOfWeek(now, { weekStartsOn: 1 }),
      to: endOfWeek(now, { weekStartsOn: 1 }),
    };
  }

  if (preset === "year") {
    return {
      preset,
      from: startOfYear(now),
      to: endOfYear(now),
    };
  }

  return {
    preset: "month",
    from: startOfMonth(now),
    to: endOfMonth(now),
  };
}

export function buildExpenseAnalytics(
  transactions: TransactionWithMerchant[],
  recurring: {
    id?: string;
    amount: unknown;
    cadence: string;
    merchant?: Merchant | null;
    lastSeenAt: Date;
    status?: string;
  }[],
  range: ExpenseRange,
) {
  const days = eachDayOfInterval({ start: startOfDay(range.from), end: startOfDay(range.to) });
  const daily = new Map(days.map((day) => [format(day, "yyyy-MM-dd"), { amount: 0, transactionCount: 0 }]));
  const category = new Map<string, number>();
  const merchant = new Map<string, number>();

  for (const transaction of transactions) {
    const amount = Number(transaction.amount);
    const dayKey = format(transaction.transactionDate, "yyyy-MM-dd");
    const currentDay = daily.get(dayKey) ?? { amount: 0, transactionCount: 0 };
    daily.set(dayKey, {
      amount: currentDay.amount + amount,
      transactionCount: currentDay.transactionCount + 1,
    });
    category.set(transaction.category ?? "Uncategorized", (category.get(transaction.category ?? "Uncategorized") ?? 0) + amount);
    merchant.set(transaction.merchant?.name ?? "Unknown", (merchant.get(transaction.merchant?.name ?? "Unknown") ?? 0) + amount);
  }

  const subscriptions = recurring
    .map((item) => {
      const amount = Number(item.amount ?? 0);
      const multiplier = item.cadence.toLowerCase().includes("year") ? 1 / 12 : 1;
      return {
        id: item.id ?? item.merchant?.name ?? "subscription",
        name: item.merchant?.name ?? "Subscription",
        amount: amount * multiplier,
        cadence: item.cadence,
        status: item.status ?? "UNKNOWN",
        lastSeenAt: item.lastSeenAt,
      };
    })
    .sort((a, b) => b.amount - a.amount);

  const subscriptionTotal = subscriptions.reduce((sum, item) => sum + item.amount, 0);
  const subscriptionCount = subscriptions.filter((item) => item.status !== "PAUSED").length;

  const dailySpend = [...daily.entries()].map(([date, value]) => ({ date, ...value }));
  const maxDailySpend = dailySpend.reduce((max, item) => Math.max(max, item.amount), 0);
  const totalSpend = transactions.reduce((sum, item) => sum + Number(item.amount), 0);

  return {
    totalSpend,
    transactionCount: transactions.length,
    dailySpend,
    maxDailySpend,
    categoryBreakdown: toBreakdown(category, totalSpend),
    merchantBreakdown: toBreakdown(merchant, totalSpend).slice(0, 8),
    subscriptions,
    subscriptionTotal,
    subscriptionCount,
  };
}

export function isExpenseTransaction(transaction: TransactionWithDetails) {
  const category = transaction.category?.toLowerCase();
  if (category === "investments" || category === "gold") return false;

  const kinds = transaction.emailSource?.parsed?.map((item) => item.kind) ?? [];
  if (kinds.some((kind) => NON_EXPENSE_EMAIL_KINDS.has(kind))) return false;

  return transaction.direction === "DEBIT";
}

export function buildInvestmentAnalytics(holdings: HoldingWithAccount[], snapshots: SnapshotWithHolding[]) {
  const totalValue = holdings.reduce((sum, item) => sum + Number(item.currentValue ?? 0), 0);
  const totalPnl = holdings.reduce((sum, item) => sum + Number(item.pnl ?? 0), 0);
  const investedValue = totalValue - totalPnl;
  const pnlPct = investedValue > 0 ? (totalPnl / investedValue) * 100 : 0;
  const assetClasses = new Map<string, number>();

  for (const holding of holdings) {
    const value = Number(holding.currentValue ?? 0);
    const assetClass = formatAssetClass(holding.assetClass);
    assetClasses.set(assetClass, (assetClasses.get(assetClass) ?? 0) + value);
  }

  const sortedHoldings = [...holdings].sort((a, b) => Number(b.currentValue ?? 0) - Number(a.currentValue ?? 0));
  const topHoldings = sortedHoldings.slice(0, 8);
  const gainers = [...holdings].sort((a, b) => Number(b.pnl ?? 0) - Number(a.pnl ?? 0)).slice(0, 5);
  const losers = [...holdings].sort((a, b) => Number(a.pnl ?? 0) - Number(b.pnl ?? 0)).slice(0, 5);

  return {
    totalValue,
    totalPnl,
    pnlPct,
    assetAllocation: toBreakdown(assetClasses, totalValue),
    topHoldings,
    gainers,
    losers,
    snapshotTrend: buildSnapshotTrend(snapshots),
  };
}

export function detectCreditCards(
  emailSignals: CreditCardEmailSignal[],
  transactions: Array<Pick<TransactionWithMerchant, "paymentInstrument" | "transactionDate" | "amount" | "confidence">>,
): CreditCardSummary[] {
  const cards = new Map<string, CreditCardSummary>();

  for (const signal of emailSignals) {
    const searchText = [
      signal.merchantName,
      signal.paymentInstrument,
      signal.emailSource.fromName,
      signal.emailSource.fromAddress,
      signal.emailSource.subject,
      signal.emailSource.snippet,
    ]
      .filter(Boolean)
      .join(" ");
    const issuer = normalizeIssuer(signal.merchantName ?? inferCardIssuer(searchText));
    const last4 = extractCardLast4(searchText);
    upsertCard(cards, {
      issuer,
      last4,
      latestAmount: signal.amount == null ? null : Number(signal.amount),
      latestSeenAt: signal.emailSource.sentAt,
      confidence: signal.confidence,
    });
  }

  for (const transaction of transactions) {
    if (!transaction.paymentInstrument || !/card/i.test(transaction.paymentInstrument)) continue;
    const issuer = normalizeIssuer(inferCardIssuer(transaction.paymentInstrument));
    const last4 = extractCardLast4(transaction.paymentInstrument);
    upsertCard(cards, {
      issuer,
      last4,
      latestAmount: Number(transaction.amount ?? 0),
      latestSeenAt: transaction.transactionDate,
      confidence: Number(transaction.confidence ?? 0.5),
    });
  }

  return [...cards.values()].sort((a, b) => b.latestSeenAt.getTime() - a.latestSeenAt.getTime());
}

function buildSnapshotTrend(snapshots: SnapshotWithHolding[]) {
  const byDay = new Map<string, number>();
  for (const snapshot of snapshots) {
    const day = format(snapshot.capturedAt, "yyyy-MM-dd");
    byDay.set(day, (byDay.get(day) ?? 0) + Number(snapshot.value ?? 0));
  }
  return [...byDay.entries()]
    .map(([date, value]) => ({ date, value }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-30);
}

function toBreakdown(values: Map<string, number>, total: number) {
  return [...values.entries()]
    .map(([label, value]) => ({
      label,
      value,
      pct: total > 0 ? (value / total) * 100 : 0,
    }))
    .sort((a, b) => b.value - a.value);
}

function upsertCard(
  cards: Map<string, CreditCardSummary>,
  input: {
    issuer: string;
    last4: string | null;
    latestAmount: number | null;
    latestSeenAt: Date;
    confidence: number;
  },
) {
  const id = `${input.issuer.toLowerCase()}-${input.last4 ?? "unknown"}`.replace(/[^a-z0-9-]+/g, "-");
  const existing = cards.get(id);
  const latestSeenAt = existing && existing.latestSeenAt > input.latestSeenAt ? existing.latestSeenAt : input.latestSeenAt;
  const latestAmount = existing && existing.latestSeenAt > input.latestSeenAt ? existing.latestAmount : input.latestAmount;
  const sourceCount = (existing?.sourceCount ?? 0) + 1;
  const confidence = Math.max(existing?.confidence ?? 0, input.confidence);

  cards.set(id, {
    id,
    issuer: input.issuer,
    displayName: input.last4 ? `${input.issuer} •••• ${input.last4}` : `${input.issuer} Credit Card`,
    last4: input.last4,
    latestAmount,
    latestSeenAt,
    sourceCount,
    confidence,
  });
}

function extractCardLast4(text: string) {
  const explicit = text.match(/(?:card|ending|xx|x{2,}|\*{2,}|no\.?)\D*(\d{4})/i);
  if (explicit?.[1]) return explicit[1];

  if (/card/i.test(text)) {
    const candidates = [...text.matchAll(/\b(\d{4})\b/g)].map((match) => match[1]);
    return candidates.at(-1) ?? null;
  }

  return null;
}

function inferCardIssuer(text: string) {
  const normalized = text.toLowerCase();
  const knownIssuers: Array<[RegExp, string]> = [
    [/hdfc/, "HDFC Bank"],
    [/icici/, "ICICI Bank"],
    [/\bsbi\b|state bank/, "SBI Card"],
    [/axis/, "Axis Bank"],
    [/kotak/, "Kotak Bank"],
    [/american express|\bamex\b/, "American Express"],
    [/indusind/, "IndusInd Bank"],
    [/\bidfc\b/, "IDFC First Bank"],
    [/\brbl\b/, "RBL Bank"],
    [/hsbc/, "HSBC"],
    [/onecard|fpl technologies/, "OneCard"],
  ];
  const issuer = knownIssuers.find(([pattern]) => pattern.test(normalized))?.[1];
  if (issuer) return issuer;

  const fromName = text.split(/[<|,-]/)[0]?.trim();
  return fromName && fromName.length > 2 ? fromName : "Detected";
}

function normalizeIssuer(value: string) {
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (!trimmed) return "Detected";
  if (/credit card$/i.test(trimmed)) return trimmed.replace(/\s+credit card$/i, "");
  return trimmed;
}

function formatAssetClass(value: string) {
  const labels: Record<string, string> = {
    STOCK: "Stocks",
    MUTUAL_FUND: "Mutual Funds",
    GOLD: "Gold",
    ETF: "ETFs",
    CASH: "Cash",
    OTHER: "Other",
  };
  return labels[value] ?? value.replaceAll("_", " ");
}

function normalizePreset(value: string | undefined): ExpenseRangePreset {
  if (value === "week" || value === "year" || value === "custom") return value;
  return "month";
}

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseDate(value: string | undefined) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

const NON_EXPENSE_EMAIL_KINDS = new Set<EmailKind>(["BROKER_STATEMENT", "GOLD", "CREDIT_CARD_BILL"]);

export type ExpenseTransaction = TransactionWithDetails;
export type InvestmentHolding = HoldingWithAccount;
