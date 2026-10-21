import type { Holding } from "@prisma/client";
import { MockLanguageModelV3 } from "ai/test";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { analyzePortfolio } from "@/lib/finance/portfolio";

const store = new Map<string, string>();
vi.mock("@/lib/redis", () => ({
  getRedis: () => ({
    status: "ready",
    get: async (key: string) => store.get(key) ?? null,
    set: async (key: string, value: string) => void store.set(key, value),
  }),
}));

const { generateAiForecast } = await import("./forecast");

function holding(symbol: string, sector: string, value: number, assetClass: Holding["assetClass"] = "STOCK"): Holding {
  return {
    id: symbol,
    userId: "u",
    accountId: "a",
    source: "kite",
    assetClass,
    instrumentKey: symbol,
    symbol,
    isin: null,
    name: symbol,
    exchange: null,
    sector,
    quantity: 1 as never,
    averagePrice: null,
    lastPrice: null,
    closePrice: null,
    currentValue: value as never,
    pnl: 0 as never,
    pnlPct: null,
    dayChange: 0 as never,
    asOf: new Date(),
    closedAt: null,
  } as Holding;
}

const portfolio = { ...analyzePortfolio([holding("INFY", "Information Technology", 700), holding("GOLDBEES", "Gold", 300, "GOLD")], { singleStockLimitPct: 10, sectorLimitPct: 25 }), positions: [] };

function modelReturning(answer: unknown) {
  return new MockLanguageModelV3({
    doGenerate: async () => ({
      content: [{ type: "text", text: JSON.stringify(answer) }],
      finishReason: { unified: "stop", raw: undefined },
      usage: { inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined }, outputTokens: { total: 20, text: 20, reasoning: undefined } },
      warnings: [],
    }),
  });
}

const bucket = (expectedReturnPct: number, volatilityPct: number) => ({ expectedReturnPct, volatilityPct, rationale: "Because." });

describe("generateAiForecast", () => {
  beforeEach(() => store.clear());

  it("clamps out-of-range assumptions and trims lists", async () => {
    const model = modelReturning({
      equity: bucket(90, 200),
      debt: bucket(7, 3),
      gold: bucket(-40, 0),
      cash: bucket(6, 1),
      inflationPct: 30,
      summary: "Tech-heavy with a gold hedge.",
      drivers: ["a", "b", "c", "d", "e"],
      risks: ["x"],
    });
    const result = await generateAiForecast({ userId: "u1", model, modelId: "mock", portfolio });
    expect(result.assumptions.buckets.equity).toMatchObject({ expectedReturnPct: 25, volatilityPct: 60 });
    expect(result.assumptions.buckets.gold).toMatchObject({ expectedReturnPct: -5, volatilityPct: 0.5 });
    expect(result.assumptions.inflationPct).toBe(10);
    expect(result.drivers).toHaveLength(4);
    expect(result.cached).toBe(false);
  });

  it("sends a summary without the user's identity and serves repeats from the cache", async () => {
    const model = modelReturning({ equity: bucket(12, 18), debt: bucket(7, 3), gold: bucket(9, 15), cash: bucket(6, 1), inflationPct: 5, summary: "s", drivers: [], risks: [] });
    await generateAiForecast({ userId: "u2", model, modelId: "mock", portfolio });
    const prompt = JSON.stringify(model.doGenerateCalls[0].prompt);
    expect(prompt).toContain("INFY");
    expect(prompt).not.toContain("u2");

    const again = await generateAiForecast({ userId: "u2", model, modelId: "mock", portfolio });
    expect(again.cached).toBe(true);
    expect(model.doGenerateCalls).toHaveLength(1);
  });
});
