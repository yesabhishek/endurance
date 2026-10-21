import { tool } from "ai";
import { z } from "zod";
import type { TenantDb } from "@/lib/db";
import { BASELINE, BUCKETS, BUCKET_LABELS, blend, bucketWeights, project } from "@/lib/finance/forecast";
import { getPortfolio } from "@/lib/finance/portfolio";
import { isExpenseTransaction } from "@/lib/finance/repositories";
import { assessRisk } from "@/lib/finance/risk";
import { TOOL_LABELS } from "./tool-labels";

// Every tool is read-only and closed over the signed-in user's scoped database
// client. The model chooses what to ask for, never whose data it reads.

const r2 = (value: number | null | undefined) => (value === null || value === undefined ? null : Math.round(value * 100) / 100);

export { TOOL_LABELS };

export function buildFinanceTools(db: TenantDb, userId: string) {
  let portfolio: Awaited<ReturnType<typeof getPortfolio>> | null = null;
  const loadPortfolio = async () => (portfolio ??= await getPortfolio(db, userId));

  return {
    portfolio_overview: tool({
      description:
        "Totals for the user's synced Kite portfolio: value, invested amount, unrealised and today's P&L, concentration, the user's own limits and any breaches. Call this first for portfolio questions.",
      inputSchema: z.object({}),
      execute: async () => {
        const p = await loadPortfolio();
        return {
          asOf: p.asOf?.toISOString() ?? null,
          holdingsCount: p.holdings.length,
          totalValueInr: r2(p.total),
          investedInr: r2(p.invested),
          unrealisedPnlInr: r2(p.totalPnl),
          unrealisedPnlPct: r2(p.totalPnlPct),
          todayChangeInr: r2(p.dayChange),
          todayChangePct: r2(p.dayChangePct),
          assetClasses: p.assetClasses.map((slice) => ({ assetClass: slice.label, pct: r2(slice.pct), valueInr: r2(slice.value) })),
          concentration: {
            largestHoldingPct: r2(p.concentration.topHoldingPct),
            top5Pct: r2(p.concentration.top5Pct),
            effectiveNumberOfHoldings: r2(p.concentration.effectivePositions),
          },
          limits: p.limits,
          breaches: {
            holdingsAboveLimit: p.breaches.overweightHoldings.map((h) => ({ symbol: h.symbol, weightPct: r2(h.weightPct) })),
            sectorsAboveLimit: p.breaches.overweightSectors.map((s) => ({ sector: s.label, pct: r2(s.pct) })),
          },
          note: p.holdings.length ? undefined : "No holdings are synced yet. The user should connect Kite in Settings.",
        };
      },
    }),

    sector_allocation: tool({
      description:
        "How direct equity is split across NSE sectors (percent of the stock portion), plus mutual fund and ETF categories (percent of the non-stock portion).",
      inputSchema: z.object({}),
      execute: async () => {
        const p = await loadPortfolio();
        return {
          asOf: p.asOf?.toISOString() ?? null,
          equityValueInr: r2(p.equityTotal),
          sectorLimitPct: p.limits.sectorLimitPct,
          sectors: p.sectors.map((s) => ({ sector: s.label, pctOfEquity: r2(s.pct), valueInr: r2(s.value), holdings: s.count, aboveLimit: s.pct > p.limits.sectorLimitPct })),
          fundCategories: p.fundCategories.map((s) => ({ category: s.label, pct: r2(s.pct), valueInr: r2(s.value), holdings: s.count })),
        };
      },
    }),

    list_holdings: tool({
      description: "Individual holdings with quantity, prices, value, weight and P&L. Filter by asset class or sector and sort as needed.",
      inputSchema: z.object({
        assetClass: z.enum(["STOCK", "MUTUAL_FUND", "ETF", "GOLD"]).optional(),
        sector: z.string().max(80).optional().describe("Exact sector or fund category name from sector_allocation"),
        sortBy: z.enum(["value", "pnl", "pnlPct", "todayChange"]).default("value"),
        limit: z.number().int().min(1).max(50).default(15),
      }),
      execute: async ({ assetClass, sector, sortBy, limit }) => {
        const p = await loadPortfolio();
        const key = { value: "value", pnl: "pnl", pnlPct: "pnlPct", todayChange: "dayChange" } as const;
        const rows = p.holdings
          .filter((h) => (!assetClass || h.assetClass === assetClass) && (!sector || h.sector.toLowerCase() === sector.toLowerCase()))
          .sort((a, b) => Number(b[key[sortBy]] ?? 0) - Number(a[key[sortBy]] ?? 0))
          .slice(0, limit);
        return {
          asOf: p.asOf?.toISOString() ?? null,
          holdings: rows.map((h) => ({
            symbol: h.symbol,
            name: h.name,
            assetClass: h.assetClass,
            sector: h.sector,
            quantity: h.quantity,
            averagePriceInr: r2(h.averagePrice),
            lastPriceInr: r2(h.lastPrice),
            valueInr: r2(h.value),
            weightPct: r2(h.weightPct),
            pnlInr: r2(h.pnl),
            pnlPct: r2(h.pnlPct),
            todayChangeInr: r2(h.dayChange),
          })),
        };
      },
    }),

    holding_history: tool({
      description: "Daily value history for one holding from past syncs.",
      inputSchema: z.object({ symbol: z.string().min(1).max(40) }),
      execute: async ({ symbol }) => {
        const holding = await db.holding.findFirst({ where: { symbol: { equals: symbol, mode: "insensitive" } }, select: { id: true, symbol: true } });
        if (!holding) return { error: `No holding named ${symbol} has been synced.` };
        const snapshots = await db.investmentSnapshot.findMany({
          where: { holdingId: holding.id },
          orderBy: { capturedAt: "desc" },
          take: 60,
          select: { capturedAt: true, value: true, price: true, quantity: true },
        });
        return {
          symbol: holding.symbol,
          points: snapshots.reverse().map((s) => ({ at: s.capturedAt.toISOString(), priceInr: r2(Number(s.price ?? 0)), valueInr: r2(Number(s.value ?? 0)), quantity: Number(s.quantity) })),
        };
      },
    }),

    list_positions: tool({
      description: "Open intraday or F&O positions from Kite (net), with P&L.",
      inputSchema: z.object({}),
      execute: async () => {
        const p = await loadPortfolio();
        return {
          positions: p.positions.map((pos) => ({ symbol: pos.symbol, exchange: pos.exchange, product: pos.product, quantity: pos.quantity, averagePriceInr: r2(pos.averagePrice), lastPriceInr: r2(pos.lastPrice), pnlInr: r2(pos.pnl), asOf: pos.asOf.toISOString() })),
        };
      },
    }),

    risk_report: tool({
      description:
        "The same five risk checks the dashboard shows: largest stock vs the user's limit, largest sector vs limit, top-5 share, effective number of holdings, and money in losing positions. Each has a zone (good, watch, high).",
      inputSchema: z.object({}),
      execute: async () => {
        const p = await loadPortfolio();
        const report = assessRisk(p);
        return {
          asOf: p.asOf?.toISOString() ?? null,
          overall: report.level,
          checks: report.checks.map((check) => ({
            check: check.label,
            value: r2(check.value),
            unit: check.unit,
            zone: check.zone,
            watchFrom: r2(check.watchAt),
            highFrom: r2(check.highAt),
            lowerIsRiskier: !check.higherIsWorse,
            detail: check.detail,
          })),
        };
      },
    }),

    growth_projection: tool({
      description:
        "Projects the portfolio forward with a seeded Monte Carlo using long-run baseline assumptions per bucket (equity, debt, gold, cash) and the current mix. Returns the 10th, 50th and 90th percentile values at chosen years. Use for questions about future value, SIPs or retirement.",
      inputSchema: z.object({
        years: z.number().int().min(1).max(40).default(20),
        monthlySipInr: z.number().min(0).max(10_000_000).default(0),
        stepUpPct: z.number().min(0).max(25).default(0).describe("Yearly increase in the SIP, percent"),
        inTodaysRupees: z.boolean().default(false).describe("Adjust for inflation"),
      }),
      execute: async ({ years, monthlySipInr, stepUpPct, inTodaysRupees }) => {
        const p = await loadPortfolio();
        if (!p.holdings.length) return { error: "No holdings are synced yet." };
        const weights = bucketWeights(p.holdings);
        const mix = blend(weights, BASELINE);
        const points = project({
          startValue: p.total,
          monthlySip: monthlySipInr,
          stepUpPct,
          years,
          expectedReturnPct: mix.expectedReturnPct,
          volatilityPct: mix.volatilityPct,
          inflationPct: BASELINE.inflationPct,
          real: inTodaysRupees,
        });
        const marks = [...new Set([1, 5, 10, 15, 20, 30, years].filter((year) => year <= years))].sort((a, b) => a - b);
        return {
          startValueInr: r2(p.total),
          assumptions: {
            mixPct: Object.fromEntries(BUCKETS.map((bucket) => [BUCKET_LABELS[bucket], r2(weights[bucket] * 100)])),
            perBucket: Object.fromEntries(BUCKETS.map((bucket) => [BUCKET_LABELS[bucket], { returnPct: BASELINE.buckets[bucket].expectedReturnPct, volatilityPct: BASELINE.buckets[bucket].volatilityPct }])),
            blendedReturnPct: r2(mix.expectedReturnPct),
            blendedVolatilityPct: r2(mix.volatilityPct),
            inflationPct: BASELINE.inflationPct,
            note: "Assumes today's mix is kept and rebalanced yearly. A projection from assumptions, not a prediction.",
          },
          milestones: marks.map((year) => {
            const point = points[year];
            return { year, p10Inr: r2(point.p10), medianInr: r2(point.p50), p90Inr: r2(point.p90), contributedInr: r2(point.contributed) };
          }),
          inTodaysRupees,
        };
      },
    }),

    spending_summary: tool({
      description: "Spending over the last N days from connected Gmail receipts: total, top categories and merchants, and recurring bills.",
      inputSchema: z.object({ days: z.number().int().min(7).max(366).default(30) }),
      execute: async ({ days }) => {
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        const [transactions, recurring] = await Promise.all([
          db.transaction.findMany({
            where: { transactionDate: { gte: since } },
            include: { merchant: { select: { name: true } }, emailSource: { select: { parsed: { select: { kind: true } } } } },
            take: 2000,
          }),
          db.recurringPayment.findMany({ include: { merchant: { select: { name: true } } }, take: 30 }),
        ]);
        const spend = transactions.filter((t) => isExpenseTransaction(t as never));
        if (!spend.length && !recurring.length) return { note: "No spending data. Gmail isn't connected or nothing matched yet." };
        const byCategory = new Map<string, number>();
        const byMerchant = new Map<string, number>();
        for (const t of spend) {
          byCategory.set(t.category ?? "Uncategorized", (byCategory.get(t.category ?? "Uncategorized") ?? 0) + Number(t.amount));
          const merchant = t.merchant?.name ?? "Unknown";
          byMerchant.set(merchant, (byMerchant.get(merchant) ?? 0) + Number(t.amount));
        }
        const top = (map: Map<string, number>) => [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, amount]) => ({ name, amountInr: r2(amount) }));
        return {
          days,
          totalInr: r2(spend.reduce((sum, t) => sum + Number(t.amount), 0)),
          transactions: spend.length,
          topCategories: top(byCategory),
          topMerchants: top(byMerchant),
          recurringMonthlyInr: r2(recurring.reduce((sum, item) => sum + Number(item.amount ?? 0), 0)),
          recurring: recurring.map((item) => ({ merchant: item.merchant.name, amountInr: r2(Number(item.amount ?? 0)), cadence: item.cadence, lastSeen: item.lastSeenAt.toISOString().slice(0, 10) })),
        };
      },
    }),

    recent_transactions: tool({
      description: "The most recent individual spending transactions (date, merchant, amount, category).",
      inputSchema: z.object({ limit: z.number().int().min(1).max(25).default(10) }),
      execute: async ({ limit }) => {
        const rows = await db.transaction.findMany({
          orderBy: { transactionDate: "desc" },
          take: limit,
          select: { transactionDate: true, amount: true, category: true, paymentInstrument: true, merchant: { select: { name: true } } },
        });
        return {
          transactions: rows.map((t) => ({ date: t.transactionDate.toISOString().slice(0, 10), merchant: t.merchant?.name ?? "Unknown", amountInr: r2(Number(t.amount)), category: t.category, paidWith: t.paymentInstrument })),
        };
      },
    }),
  };
}
