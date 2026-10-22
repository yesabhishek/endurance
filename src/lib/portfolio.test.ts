import { describe, expect, it } from "vitest";
import { analyzePortfolio, type Holding } from "./portfolio";

function holding(overrides: Partial<Holding> & { symbol: string; value: number }): Holding {
  return { key: `NSE:${overrides.symbol}`, assetClass: "STOCK", isin: null, name: overrides.symbol, exchange: "NSE", sector: "Unclassified", quantity: 1, averagePrice: null, lastPrice: null, closePrice: null, pnl: 0, pnlPct: null, dayChange: 0, ...overrides };
}

describe("portfolio analysis", () => {
  const holdings = [
    holding({ symbol: "HDFCBANK", sector: "Financial Services", value: 217500, pnl: 35052, dayChange: 1200 }),
    holding({ symbol: "ICICIBANK", sector: "Financial Services", value: 196392, pnl: 43932 }),
    holding({ symbol: "INFY", sector: "Information Technology", value: 161338.5, pnl: 28139 }),
    holding({ symbol: "ITC", sector: "Fast Moving Consumer Goods", value: 125670, pnl: -10035, dayChange: -300 }),
    holding({ symbol: "PPFAS", assetClass: "MUTUAL_FUND", sector: "Equity: flexi & multi cap", value: 299099.5, pnl: 50000 }),
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
    expect(result.sectors).toHaveLength(3);
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
