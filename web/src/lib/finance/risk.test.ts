import type { Holding } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { analyzePortfolio } from "./portfolio";
import { assessRisk } from "./risk";

function holding(symbol: string, sector: string, value: number, pnl = 0, assetClass: Holding["assetClass"] = "STOCK"): Holding {
  return {
    id: symbol,
    userId: "u",
    accountId: "a",
    source: "kite",
    assetClass,
    instrumentKey: `NSE:${symbol}`,
    symbol,
    isin: null,
    name: symbol,
    exchange: "NSE",
    sector,
    quantity: 1 as never,
    averagePrice: null,
    lastPrice: null,
    closePrice: null,
    currentValue: value as never,
    pnl: pnl as never,
    pnlPct: null,
    dayChange: 0 as never,
    asOf: new Date("2026-10-20T04:00:00Z"),
    closedAt: null,
  } as Holding;
}

const limits = { singleStockLimitPct: 10, sectorLimitPct: 25 };

describe("assessRisk", () => {
  it("flags a stock over the user's limit and its sector", () => {
    const portfolio = analyzePortfolio(
      [
        holding("HDFCBANK", "Financial Services", 300, 20),
        holding("ICICIBANK", "Financial Services", 100, -10),
        ...Array.from({ length: 12 }, (_, i) => holding(`S${i}`, `Sector ${i}`, 50, 5)),
      ],
      limits,
    );
    const report = assessRisk(portfolio);
    const byId = Object.fromEntries(report.checks.map((check) => [check.id, check]));
    expect(byId["single-stock"].zone).toBe("high");
    expect(byId["single-stock"].detail).toContain("HDFCBANK");
    expect(byId.sector.zone).toBe("high");
    expect(byId.sector.value).toBeCloseTo((400 / 1000) * 100);
    expect(byId["in-loss"].value).toBeCloseTo(10);
    expect(byId["in-loss"].zone).toBe("good");
    expect(report.level).toBe("High");
  });

  it("treats fewer effective holdings as riskier", () => {
    const narrow = assessRisk(analyzePortfolio([holding("A", "X", 50), holding("B", "Y", 50)], { singleStockLimitPct: 60, sectorLimitPct: 60 }));
    const breadth = narrow.checks.find((check) => check.id === "breadth")!;
    expect(breadth.value).toBeCloseTo(2);
    expect(breadth.zone).toBe("high");
    expect(breadth.higherIsWorse).toBe(false);
  });

  it("reports a calm, broad portfolio as low risk", () => {
    const broad = analyzePortfolio(
      Array.from({ length: 25 }, (_, i) => holding(`S${i}`, `Sector ${i % 8}`, 40, 4)),
      limits,
    );
    const report = assessRisk(broad);
    expect(report.highCount).toBe(0);
    expect(report.level).toBe("Low");
  });

  it("ignores the unclassified bucket when picking the largest sector", () => {
    const report = assessRisk(analyzePortfolio([holding("SME1", "Unclassified", 500), holding("TCS", "Information Technology", 100)], limits));
    expect(report.checks.find((check) => check.id === "sector")!.detail).toContain("Information Technology");
  });
});
