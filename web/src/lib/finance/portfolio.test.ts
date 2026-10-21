import type { Holding } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { analyzePortfolio } from "./portfolio";

function holding(overrides: Omit<Partial<Holding>, "currentValue" | "pnl"> & { currentValue: number; pnl?: number }): Holding {
  return {
    id: overrides.symbol ?? "h",
    userId: "user-1",
    accountId: "acct",
    source: "kite",
    assetClass: "STOCK",
    instrumentKey: `NSE:${overrides.symbol}`,
    symbol: "X",
    isin: null,
    name: overrides.symbol ?? "X",
    exchange: "NSE",
    sector: "Unclassified",
    quantity: 1 as never,
    averagePrice: null,
    lastPrice: null,
    closePrice: null,
    pnlPct: null,
    dayChange: 0 as never,
    asOf: new Date("2026-10-20T04:11:00Z"),
    closedAt: null,
    ...overrides,
    currentValue: overrides.currentValue as never,
    pnl: (overrides.pnl ?? 0) as never,
  } as Holding;
}

describe("portfolio analysis", () => {
  const holdings = [
    holding({ symbol: "HDFCBANK", sector: "Financial Services", currentValue: 217500, pnl: 35052, dayChange: 1200 as never }),
    holding({ symbol: "ICICIBANK", sector: "Financial Services", currentValue: 196392, pnl: 43932 }),
    holding({ symbol: "INFY", sector: "Information Technology", currentValue: 161338.5, pnl: 28139 }),
    holding({ symbol: "ITC", sector: "Fast Moving Consumer Goods", currentValue: 125670, pnl: -10035, dayChange: -300 as never }),
    holding({ symbol: "PPFAS", assetClass: "MUTUAL_FUND", sector: "Equity: flexi & multi cap", currentValue: 299099.5, pnl: 50000 }),
  ];
  const result = analyzePortfolio(holdings, { singleStockLimitPct: 10, sectorLimitPct: 25 });

  it("totals value, P&L and today's change", () => {
    expect(result.total).toBe(1000000);
    expect(result.totalPnl).toBe(147088);
    expect(result.dayChange).toBe(900);
  });

  it("measures sectors as a share of direct equity only", () => {
    const financial = result.sectors.find((s) => s.label === "Financial Services")!;
    expect(result.equityTotal).toBe(700900.5);
    expect(financial.pct).toBeCloseTo(((217500 + 196392) / 700900.5) * 100, 6);
    expect(result.sectorCount).toBe(3);
    expect(result.fundCategories).toEqual([{ label: "Equity: flexi & multi cap", value: 299099.5, count: 1, pct: 100 }]);
  });

  it("flags holdings and sectors above the user's limits", () => {
    expect(result.breaches.overweightHoldings.map((h) => h.symbol)).toEqual(["HDFCBANK", "ICICIBANK", "INFY", "ITC"]);
    expect(result.breaches.overweightSectors.map((s) => s.label)).toEqual(["Financial Services"]);
  });

  it("handles an empty portfolio without dividing by zero", () => {
    const empty = analyzePortfolio([], { singleStockLimitPct: 10, sectorLimitPct: 25 });
    expect(empty.total).toBe(0);
    expect(empty.totalPnlPct).toBe(0);
    expect(empty.concentration.effectivePositions).toBe(0);
  });
});
