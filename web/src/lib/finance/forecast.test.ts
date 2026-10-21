import { describe, expect, it } from "vitest";
import { BASELINE, blend, bucketMix, bucketWeights, clampAssumption, project } from "./forecast";

describe("forecast buckets", () => {
  it("maps holdings to buckets from asset class and category", () => {
    expect(bucketMix({ assetClass: "STOCK", sector: "Financial Services" })).toEqual({ equity: 1 });
    expect(bucketMix({ assetClass: "MUTUAL_FUND", sector: "Debt: liquid" })).toEqual({ cash: 1 });
    expect(bucketMix({ assetClass: "MUTUAL_FUND", sector: "Debt" })).toEqual({ debt: 1 });
    expect(bucketMix({ assetClass: "MUTUAL_FUND", sector: "Hybrid" })).toEqual({ equity: 0.6, debt: 0.4 });
    expect(bucketMix({ assetClass: "ETF", sector: "Silver" })).toEqual({ gold: 1 });
    expect(bucketMix({ assetClass: "ETF", sector: "Liquid / cash" })).toEqual({ cash: 1 });
    expect(bucketMix({ assetClass: "GOLD", sector: "Gold" })).toEqual({ gold: 1 });
  });

  it("weights add up to one and split hybrids", () => {
    const weights = bucketWeights([
      { assetClass: "STOCK", sector: "IT", value: 600 },
      { assetClass: "MUTUAL_FUND", sector: "Hybrid", value: 200 },
      { assetClass: "GOLD", sector: "Gold", value: 200 },
    ]);
    expect(weights.equity).toBeCloseTo(0.72);
    expect(weights.debt).toBeCloseTo(0.08);
    expect(weights.gold).toBeCloseTo(0.2);
    expect(weights.equity + weights.debt + weights.gold + weights.cash).toBeCloseTo(1);
  });
});

describe("blend", () => {
  it("returns a single bucket's own assumptions", () => {
    const mix = blend({ equity: 1, debt: 0, gold: 0, cash: 0 }, BASELINE);
    expect(mix.expectedReturnPct).toBeCloseTo(12);
    expect(mix.volatilityPct).toBeCloseTo(18);
  });

  it("diversifies volatility across weakly correlated buckets", () => {
    const mix = blend({ equity: 0.5, debt: 0, gold: 0.5, cash: 0 }, BASELINE);
    expect(mix.expectedReturnPct).toBeCloseTo(10.5);
    expect(mix.volatilityPct).toBeLessThan((18 + 15) / 2);
  });
});

describe("project", () => {
  const base = { startValue: 1_000_000, monthlySip: 0, stepUpPct: 0, years: 20, expectedReturnPct: 12, volatilityPct: 18, inflationPct: 5, real: false };

  it("is deterministic for the same inputs", () => {
    expect(project(base)).toEqual(project(base));
  });

  it("orders percentiles and starts at today's value", () => {
    const points = project(base);
    expect(points).toHaveLength(21);
    expect(points[0].p50).toBe(1_000_000);
    for (const point of points.slice(1)) {
      expect(point.p10).toBeLessThan(point.p25);
      expect(point.p25).toBeLessThan(point.p50);
      expect(point.p50).toBeLessThan(point.p75);
      expect(point.p75).toBeLessThan(point.p90);
    }
  });

  it("puts the median near compound growth at the geometric rate", () => {
    const points = project({ ...base, paths: 4000 });
    const geometric = Math.log(1.12) - 0.18 ** 2 / 2;
    const expected = 1_000_000 * Math.exp(geometric * 20);
    expect(points[20].p50 / expected).toBeGreaterThan(0.9);
    expect(points[20].p50 / expected).toBeLessThan(1.1);
  });

  it("counts SIP contributions with a yearly step-up", () => {
    const points = project({ ...base, monthlySip: 10_000, stepUpPct: 10, years: 2 });
    expect(points[1].contributed).toBe(1_000_000 + 120_000);
    expect(points[2].contributed).toBeCloseTo(1_000_000 + 120_000 + 132_000);
  });

  it("deflates to today's rupees", () => {
    const nominal = project({ ...base, volatilityPct: 0 });
    const real = project({ ...base, volatilityPct: 0, real: true });
    expect(real[10].p50).toBeCloseTo(nominal[10].p50 / 1.05 ** 10, 0);
  });
});

describe("clampAssumption", () => {
  it("keeps values in range and replaces garbage", () => {
    expect(clampAssumption(80, -5, 25, 12)).toBe(25);
    expect(clampAssumption(-20, -5, 25, 12)).toBe(-5);
    expect(clampAssumption(Number.NaN, -5, 25, 12)).toBe(12);
  });
});
