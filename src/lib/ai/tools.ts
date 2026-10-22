import { tool } from "ai";
import { z } from "zod";
import type { Limits } from "@/lib/config";
import type { PortfolioData } from "@/lib/data";
import { analyzePortfolio, assetClassLabel, shortName, type HistoryPoint, type PortfolioAnalysis, type Snapshot } from "@/lib/portfolio";
import { assessRisk } from "@/lib/risk";
import { TOOL_TITLES } from "./tool-titles";

// The assistant's only window into your data. Every tool is read-only and returns
// a `source` block with a reference like "S3" that the answer must cite, so each
// number can be traced back to the exact data it came from.

export type SourceMeta = { ref: string; title: string; origin: string; asOf: string | null };

const KITE = "Zerodha Kite (holdings, mutual funds, positions, margins)";

const r2 = (value: number | null | undefined) => (value === null || value === undefined || !Number.isFinite(value) ? null : Math.round(value * 100) / 100);

type Context = {
  load: () => Promise<PortfolioData>;
  history: () => Promise<HistoryPoint[]>;
  limits: Limits;
  /** Hands out S1, S2, ... continuing from earlier turns in the thread. */
  nextRef: () => string;
};

export function buildTools(ctx: Context) {
  let cached: Promise<{ data: PortfolioData; analysis: PortfolioAnalysis | null }> | null = null;
  const portfolio = () =>
    (cached ??= ctx.load().then((data) => ({ data, analysis: data.snapshot ? analyzePortfolio(data.snapshot.holdings, ctx.limits) : null })));

  function source(title: string, snapshot: Snapshot | null, origin = KITE): SourceMeta {
    return { ref: ctx.nextRef(), title, origin: snapshot?.source === "demo" ? "Sample portfolio (demo mode)" : origin, asOf: snapshot?.asOf ?? null };
  }

  /** Common caveats the model should pass on: no data yet, or a snapshot from an expired session. */
  function dataNote(data: PortfolioData) {
    if (!data.snapshot) return "No portfolio data yet. The user needs to log in to Kite from the Setup page.";
    if (data.status.state === "expired") return `The Kite session has expired, so this is the last saved snapshot (${data.snapshot.asOf}). The user can log in again from Setup for live prices.`;
    if (data.error) return `Refreshing from Kite failed (${data.error}); this is the last saved snapshot.`;
    return undefined;
  }

  const noData = (title: string, data: PortfolioData) => ({ source: source(title, null), error: dataNote(data) });

  return {
    portfolio_summary: tool({
      description:
        "Totals for the whole portfolio: current value, amount invested, unrealised P&L, today's change, mix by asset class, concentration, available funds, and holdings or sectors over the user's own limits. Call this first for most questions.",
      inputSchema: z.object({}),
      execute: async () => {
        const { data, analysis: p } = await portfolio();
        if (!data.snapshot || !p) return noData(TOOL_TITLES.portfolio_summary, data);
        return {
          source: source(TOOL_TITLES.portfolio_summary, data.snapshot),
          note: dataNote(data),
          kiteUserId: data.snapshot.account.userId,
          holdingsCount: p.holdings.length,
          currentValueInr: r2(p.total),
          investedInr: r2(p.invested),
          unrealisedPnlInr: r2(p.totalPnl),
          unrealisedPnlPct: r2(p.totalPnlPct),
          todayChangeInr: r2(p.dayChange),
          todayChangePct: r2(p.dayChangePct),
          todayChangeCoverage: "Stocks, ETFs and gold only. Kite does not report a day change for mutual funds.",
          availableFundsInr: r2(data.snapshot.availableFunds),
          availableFundsMeaning: "Net margin in the Kite equity segment; not included in current value.",
          assetClasses: p.assetClasses.map((slice) => ({ assetClass: slice.label, valueInr: r2(slice.value), pctOfPortfolio: r2(slice.pct), holdings: slice.count })),
          concentration: {
            largestHolding: p.holdings[0] ? { name: shortName(p.holdings[0]), pctOfPortfolio: r2(p.holdings[0].weightPct) } : null,
            top5PctOfPortfolio: r2(p.concentration.top5Pct),
            effectiveNumberOfHoldings: r2(p.concentration.effectivePositions),
          },
          userLimits: { maxPctPerStock: ctx.limits.singleStockLimitPct, maxPctPerSectorOfStocks: ctx.limits.sectorLimitPct },
          overLimit: {
            stocks: p.breaches.overweightHoldings.map((h) => ({ symbol: h.symbol, pctOfPortfolio: r2(h.weightPct) })),
            sectors: p.breaches.overweightSectors.map((s) => ({ sector: s.label, pctOfStocks: r2(s.pct) })),
          },
          openPositions: data.snapshot.positions.length,
        };
      },
    }),

    list_holdings: tool({
      description:
        "Individual holdings with quantity, average buy price, last price, value, weight, unrealised P&L and today's move. Filter by asset class, sector/category or a name search; sort and limit as needed. Returns totals for the matched rows.",
      inputSchema: z.object({
        assetClass: z.enum(["STOCK", "MUTUAL_FUND", "ETF", "GOLD"]).optional(),
        sector: z.string().max(80).optional().describe("Exact sector or fund category name as returned by the allocation tool"),
        search: z.string().max(60).optional().describe("Case-insensitive match on symbol or name"),
        sortBy: z.enum(["value", "pnl", "pnlPct", "todayChange", "todayPct"]).default("value"),
        order: z.enum(["desc", "asc"]).default("desc"),
        limit: z.number().int().min(1).max(100).default(25),
      }),
      execute: async ({ assetClass, sector, search, sortBy, order, limit }) => {
        const { data, analysis: p } = await portfolio();
        if (!data.snapshot || !p) return noData(TOOL_TITLES.list_holdings, data);
        const needle = search?.toLowerCase();
        const key = { value: "value", pnl: "pnl", pnlPct: "pnlPct", todayChange: "dayChange", todayPct: "dayPct" } as const;
        const matched = p.holdings.filter(
          (h) =>
            (!assetClass || h.assetClass === assetClass) &&
            (!sector || h.sector.toLowerCase() === sector.toLowerCase()) &&
            (!needle || h.symbol.toLowerCase().includes(needle) || h.name.toLowerCase().includes(needle)),
        );
        const sign = order === "asc" ? 1 : -1;
        const rows = [...matched].sort((a, b) => sign * (Number(a[key[sortBy]] ?? 0) - Number(b[key[sortBy]] ?? 0))).slice(0, limit);
        const sum = (pick: (h: (typeof matched)[number]) => number) => r2(matched.reduce((total, h) => total + pick(h), 0));
        return {
          source: source(TOOL_TITLES.list_holdings, data.snapshot),
          note: dataNote(data),
          filters: { assetClass: assetClass ?? null, sector: sector ?? null, search: search ?? null, sortBy, order },
          matchedCount: matched.length,
          shownCount: rows.length,
          matchedTotals: { valueInr: sum((h) => h.value), investedInr: sum((h) => h.invested), pnlInr: sum((h) => h.pnl), pctOfPortfolio: sum((h) => h.weightPct) },
          holdings: rows.map((h) => ({
            symbol: h.symbol,
            name: shortName(h),
            assetClass: assetClassLabel(h.assetClass),
            sector: h.sector,
            quantity: r2(h.quantity),
            avgBuyPriceInr: r2(h.averagePrice),
            lastPriceInr: r2(h.lastPrice),
            valueInr: r2(h.value),
            investedInr: r2(h.invested),
            pctOfPortfolio: r2(h.weightPct),
            pnlInr: r2(h.pnl),
            pnlPct: r2(h.pnlPct),
            todayChangeInr: h.assetClass === "MUTUAL_FUND" ? null : r2(h.dayChange),
            todayPct: h.assetClass === "MUTUAL_FUND" ? null : r2(h.dayPct),
          })),
        };
      },
    }),

    allocation: tool({
      description:
        "How the money is spread: by asset class, by NSE sector for direct stocks (as a share of stocks and of the whole portfolio), and by category for mutual funds, ETFs and gold.",
      inputSchema: z.object({}),
      execute: async () => {
        const { data, analysis: p } = await portfolio();
        if (!data.snapshot || !p) return noData(TOOL_TITLES.allocation, data);
        return {
          source: source(TOOL_TITLES.allocation, data.snapshot, `${KITE}; sectors from NSE index constituent lists`),
          note: dataNote(data),
          totalValueInr: r2(p.total),
          stocksValueInr: r2(p.equityTotal),
          sectorLimitPctOfStocks: ctx.limits.sectorLimitPct,
          assetClasses: p.assetClasses.map((s) => ({ assetClass: s.label, valueInr: r2(s.value), pctOfPortfolio: r2(s.pct), holdings: s.count })),
          stockSectors: p.sectors.map((s) => ({
            sector: s.label,
            valueInr: r2(s.value),
            pctOfStocks: r2(s.pct),
            pctOfPortfolio: r2(p.total ? (s.value / p.total) * 100 : 0),
            holdings: s.count,
            overLimit: s.label !== "Unclassified" && s.pct > ctx.limits.sectorLimitPct,
          })),
          fundAndEtfCategories: p.fundCategories.map((s) => ({ category: s.label, valueInr: r2(s.value), pctOfPortfolio: r2(p.total ? (s.value / p.total) * 100 : 0), holdings: s.count })),
          classificationNote: p.unclassified
            ? `${p.unclassified.count} stock(s) worth ₹${Math.round(p.unclassified.value).toLocaleString("en-IN")} are not in NSE's Total Market list (often SME or newly listed), so they show as Unclassified.`
            : undefined,
          fundCategoryNote: "Fund categories are inferred from scheme names; Endurance does not look inside a fund's portfolio.",
        };
      },
    }),

    risk_checks: tool({
      description:
        "The five concentration and drawdown checks the Portfolio page shows (largest stock vs limit, largest sector vs limit, top-5 share, effective number of holdings, money in losing positions), each with its zone and thresholds. Use for any question about risk or diversification.",
      inputSchema: z.object({}),
      execute: async () => {
        const { data, analysis: p } = await portfolio();
        if (!data.snapshot || !p) return noData(TOOL_TITLES.risk_checks, data);
        const report = assessRisk(p);
        return {
          source: source(TOOL_TITLES.risk_checks, data.snapshot, `Computed by Endurance from ${KITE}`),
          note: dataNote(data),
          overall: report.level,
          method: "Single-stock and sector zones use the user's own limits (watch from 80% of the limit). Top-5 watch 40%, high 60%. Effective holdings = 1 / sum of squared weights; watch below 15, high below 8. Money in losing positions watch 15%, high 30%.",
          checks: report.checks.map((check) => ({
            check: check.label,
            value: r2(check.value),
            unit: check.unit,
            zone: check.zone,
            watchFrom: r2(check.watchAt),
            highFrom: r2(check.highAt),
            detail: check.detail,
          })),
        };
      },
    }),

    open_positions: tool({
      description: "Open intraday, F&O or delivery positions (net) from Kite with quantity, prices and P&L. Separate from long-term holdings.",
      inputSchema: z.object({}),
      execute: async () => {
        const { data } = await portfolio();
        if (!data.snapshot) return noData(TOOL_TITLES.open_positions, data);
        return {
          source: source(TOOL_TITLES.open_positions, data.snapshot),
          note: dataNote(data),
          positions: data.snapshot.positions.map((pos) => ({
            symbol: pos.symbol,
            exchange: pos.exchange,
            product: pos.product,
            quantity: pos.quantity,
            avgPriceInr: r2(pos.averagePrice),
            lastPriceInr: r2(pos.lastPrice),
            pnlInr: r2(pos.pnl),
          })),
        };
      },
    }),

    value_history: tool({
      description:
        "Daily total value and amount invested over a period, from the snapshots Endurance has saved (one per day you opened the app while logged in to Kite). Returns the change, market gain excluding money added, peak, trough and largest drawdown.",
      inputSchema: z.object({ days: z.number().int().min(7).max(3650).default(365) }),
      execute: async ({ days }) => {
        const { data } = await portfolio();
        const all = await ctx.history();
        const cutoff = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
        const points = all.filter((point) => point.date >= cutoff);
        const meta = source(TOOL_TITLES.value_history, data.snapshot, "Daily snapshots saved by Endurance from Kite");
        if (points.length < 2) {
          return { source: meta, error: `Only ${points.length} saved day(s) in this period. History builds up one point per day the app syncs with Kite; Kite's free API has no past portfolio values.` };
        }
        const first = points[0];
        const last = points.at(-1)!;
        let peak = points[0];
        let trough = points[0];
        let maxDrawdown = 0;
        let runningPeak = points[0];
        for (const point of points) {
          if (point.value > peak.value) peak = point;
          if (point.value < trough.value) trough = point;
          if (point.value > runningPeak.value) runningPeak = point;
          maxDrawdown = Math.max(maxDrawdown, runningPeak.value > 0 ? ((runningPeak.value - point.value) / runningPeak.value) * 100 : 0);
        }
        const step = Math.max(1, Math.ceil(points.length / 30));
        const sample = points.filter((_, i) => i % step === 0 || i === points.length - 1);
        const marketGain = last.value - last.invested - (first.value - first.invested);
        return {
          source: meta,
          note: dataNote(data),
          daysRecorded: points.length,
          from: first.date,
          to: last.date,
          start: { valueInr: r2(first.value), investedInr: r2(first.invested) },
          end: { valueInr: r2(last.value), investedInr: r2(last.invested) },
          valueChangeInr: r2(last.value - first.value),
          netMoneyAddedInr: r2(last.invested - first.invested),
          marketGainInr: r2(marketGain),
          marketGainPctOfStartValue: r2(first.value ? (marketGain / first.value) * 100 : null),
          peak: { date: peak.date, valueInr: r2(peak.value) },
          trough: { date: trough.date, valueInr: r2(trough.value) },
          maxDrawdownPct: r2(maxDrawdown),
          sampledPoints: sample.map((point) => ({ date: point.date, valueInr: r2(point.value), investedInr: r2(point.invested) })),
        };
      },
    }),

    what_if: tool({
      description:
        "Arithmetic on today's holdings: applies instant price changes (for a symbol, a sector or category, an asset class, or everything) and returns the rupee and percent impact. Use for 'what if X falls 20%' questions. It is not a forecast and says nothing about how likely a move is.",
      inputSchema: z.object({
        shocks: z
          .array(
            z.object({
              scope: z.enum(["symbol", "sector", "assetClass", "all"]),
              match: z.string().max(80).optional().describe("Symbol, exact sector/category name, or STOCK | MUTUAL_FUND | ETF | GOLD. Omit for scope 'all'."),
              changePct: z.number().min(-100).max(500).describe("Price change in percent, e.g. -20"),
            }),
          )
          .min(1)
          .max(10),
      }),
      execute: async ({ shocks }) => {
        const { data, analysis: p } = await portfolio();
        if (!data.snapshot || !p) return noData(TOOL_TITLES.what_if, data);
        const specificity = { symbol: 3, sector: 2, assetClass: 1, all: 0 } as const;
        const matches = (shock: (typeof shocks)[number], h: (typeof p.holdings)[number]) => {
          const value = shock.match?.toLowerCase();
          if (shock.scope === "all") return true;
          if (!value) return false;
          if (shock.scope === "symbol") return h.symbol.toLowerCase() === value || shortName(h).toLowerCase() === value;
          if (shock.scope === "sector") return h.sector.toLowerCase() === value;
          return h.assetClass.toLowerCase() === value;
        };
        const used = new Set<number>();
        const affected = p.holdings
          .map((h) => {
            let best: { index: number; shock: (typeof shocks)[number] } | null = null;
            shocks.forEach((shock, index) => {
              if (matches(shock, h) && (!best || specificity[shock.scope] > specificity[best.shock.scope])) best = { index, shock };
            });
            if (!best) return null;
            const chosen = best as { index: number; shock: (typeof shocks)[number] };
            used.add(chosen.index);
            return { name: shortName(h), sector: h.sector, valueInr: h.value, changePct: chosen.shock.changePct, impactInr: (h.value * chosen.shock.changePct) / 100 };
          })
          .filter((row) => row !== null);
        const impact = affected.reduce((sum, row) => sum + row.impactInr, 0);
        return {
          source: source(TOOL_TITLES.what_if, data.snapshot, `Calculated by Endurance on ${KITE}`),
          note: dataNote(data),
          assumption: "Each matched holding's price moves instantly by the given percent; everything else stays the same. Open F&O positions are not included. This is arithmetic, not a prediction.",
          beforeInr: r2(p.total),
          afterInr: r2(p.total + impact),
          impactInr: r2(impact),
          impactPctOfPortfolio: r2(p.total ? (impact / p.total) * 100 : 0),
          holdingsAffected: affected.length,
          biggestImpacts: affected
            .sort((a, b) => Math.abs(b.impactInr) - Math.abs(a.impactInr))
            .slice(0, 15)
            .map((row) => ({ ...row, valueInr: r2(row.valueInr), impactInr: r2(row.impactInr) })),
          unmatchedShocks: shocks.filter((_, index) => !used.has(index)),
        };
      },
    }),
  };
}

export type FinanceTools = ReturnType<typeof buildTools>;
