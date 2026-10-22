import { describe, expect, it } from "vitest";
import { demoHistory, demoSnapshot } from "@/lib/demo";
import type { PortfolioData } from "@/lib/data";
import { buildTools } from "./tools";

const limits = { singleStockLimitPct: 10, sectorLimitPct: 25 };
const options = { toolCallId: "t", messages: [] };

/** Tool results can be streamed in general; ours never are. */
async function run<T>(value: T | PromiseLike<T> | AsyncIterable<T>): Promise<T> {
  const result = await value;
  if (result && typeof result === "object" && Symbol.asyncIterator in result) throw new Error("unexpected streaming tool result");
  return result as T;
}

function tools(data: Partial<PortfolioData> = {}, startRef = 0) {
  let ref = startRef;
  const portfolio: PortfolioData = { snapshot: demoSnapshot(), status: { state: "demo", userId: "DEMO01", userName: "Demo" }, error: null, ...data };
  return buildTools({ load: async () => portfolio, history: async () => demoHistory(), limits, nextRef: () => `S${++ref}` });
}

describe("assistant tools", () => {
  it("numbers every source so answers can cite it, continuing from earlier turns", async () => {
    const set = tools({}, 4);
    const summary = await run(set.portfolio_summary.execute!({}, options));
    const risk = await run(set.risk_checks.execute!({}, options));
    expect(summary.source.ref).toBe("S5");
    expect(risk.source.ref).toBe("S6");
    expect(summary.source.asOf).toBeTruthy();
  });

  it("computes a what-if as plain arithmetic on today's holdings", async () => {
    const result = await run(tools().what_if.execute!({ shocks: [{ scope: "symbol", match: "HDFCBANK", changePct: -20 }] }, options));
    if (!("impactInr" in result)) throw new Error("expected a result");
    // HDFCBANK: 170 shares at ₹1,712 = ₹2,91,040; 20% of that is ₹58,208.
    expect(result.impactInr).toBe(-58208);
    expect(result.holdingsAffected).toBe(1);
    expect(result.afterInr).toBe((result.beforeInr ?? 0) - 58208);
    expect(result.unmatchedShocks).toEqual([]);
  });

  it("applies the most specific shock and reports ones that matched nothing", async () => {
    const result = await run(tools().what_if.execute!(
      {
        shocks: [
          { scope: "all", changePct: -10 },
          { scope: "symbol", match: "INFY", changePct: -30 },
          { scope: "symbol", match: "NOTHELD", changePct: -50 },
        ],
      },
      options,
    ));
    if (!("biggestImpacts" in result)) throw new Error("expected a result");
    const infy = result.biggestImpacts.find((row) => row.name === "INFY");
    expect(infy?.changePct).toBe(-30);
    expect(result.unmatchedShocks).toEqual([{ scope: "symbol", match: "NOTHELD", changePct: -50 }]);
    expect(result.impactPctOfPortfolio).toBeLessThan(-10);
  });

  it("filters holdings and totals the matched rows", async () => {
    const result = await run(tools().list_holdings.execute!({ sector: "Financial Services", sortBy: "value", order: "desc", limit: 25 }, options));
    if (!("holdings" in result)) throw new Error("expected holdings");
    expect(result.holdings.map((h) => h.symbol)).toEqual(["HDFCBANK", "ICICIBANK", "BAJFINANCE", "KOTAKBANK"]);
    expect(result.matchedTotals.valueInr).toBe(665140);
  });

  it("says what's missing instead of returning empty numbers", async () => {
    const result = await run(tools({ snapshot: null, status: { state: "logged-out" } }).portfolio_summary.execute!({}, options));
    expect(result).toMatchObject({ error: expect.stringContaining("log in to Kite") });
  });

  it("flags a snapshot from an expired session", async () => {
    const result = await run(tools({ status: { state: "expired", userId: "AB1234", userName: "A" } }).allocation.execute!({}, options));
    expect("note" in result && result.note).toContain("expired");
  });
});
