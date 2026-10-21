import { describe, expect, it } from "vitest";
import {
  buildExpenseAnalytics,
  buildInvestmentAnalytics,
  detectCreditCards,
  isExpenseTransaction,
  parseExpenseRange,
} from "./repositories";

describe("finance repository helpers", () => {
  it("defaults expense ranges to the current month", () => {
    const range = parseExpenseRange({}, new Date("2026-04-15T10:00:00"));

    expect(range.preset).toBe("month");
    expect(range.from.getDate()).toBe(1);
    expect(range.to.getDate()).toBe(30);
  });

  it("accepts custom expense date ranges", () => {
    const range = parseExpenseRange({ preset: "custom", from: "2026-01-10", to: "2026-02-20" });

    expect(range.preset).toBe("custom");
    expect(range.from.getDate()).toBe(10);
    expect(range.to.getDate()).toBe(20);
  });

  it("builds expense breakdowns, daily counts, and subscription totals", () => {
    const range = parseExpenseRange({ preset: "custom", from: "2026-04-01", to: "2026-04-03" });
    const merchant = { name: "Coffee Bar" };

    const analytics = buildExpenseAnalytics(
      [
        {
          id: "txn-1",
          amount: 500,
          transactionDate: new Date("2026-04-01T10:00:00"),
          category: "Food",
          merchant,
        },
        {
          id: "txn-2",
          amount: 1500,
          transactionDate: new Date("2026-04-02T10:00:00"),
          category: "Bills",
          merchant: { name: "Power Co" },
        },
      ] as never,
      [
        {
          id: "sub-1",
          amount: 1200,
          cadence: "monthly",
          merchant: { name: "Streaming" },
          lastSeenAt: new Date("2026-04-02T10:00:00"),
          status: "ACTIVE",
        },
      ] as never,
      range,
    );

    expect(analytics.totalSpend).toBe(2000);
    expect(analytics.dailySpend).toHaveLength(3);
    expect(analytics.dailySpend[0]).toMatchObject({ amount: 500, transactionCount: 1 });
    expect(analytics.categoryBreakdown[0]).toMatchObject({ label: "Bills", value: 1500 });
    expect(analytics.subscriptionTotal).toBe(1200);
    expect(analytics.subscriptionCount).toBe(1);
    expect(analytics.subscriptions[0]).toMatchObject({ name: "Streaming", amount: 1200, cadence: "monthly" });
  });

  it("does not treat investment, gold, or card statement records as spend", () => {
    expect(
      isExpenseTransaction({
        direction: "DEBIT",
        category: "Investments",
        emailSource: { parsed: [{ kind: "BROKER_STATEMENT" }] },
      } as never),
    ).toBe(false);
    expect(
      isExpenseTransaction({
        direction: "DEBIT",
        category: "Gold",
        emailSource: { parsed: [{ kind: "GOLD" }] },
      } as never),
    ).toBe(false);
    expect(
      isExpenseTransaction({
        direction: "DEBIT",
        category: "Bills",
        emailSource: { parsed: [{ kind: "CREDIT_CARD_BILL" }] },
      } as never),
    ).toBe(false);
    expect(
      isExpenseTransaction({
        direction: "DEBIT",
        category: "Food",
        emailSource: { parsed: [{ kind: "UPI_PAYMENT" }] },
      } as never),
    ).toBe(true);
  });

  it("builds investment allocation and movers", () => {
    const analytics = buildInvestmentAnalytics(
      [
        {
          id: "h1",
          name: "Alpha",
          symbol: "ALPHA",
          assetClass: "STOCK",
          currentValue: 600,
          pnl: 60,
          account: { provider: "broker", accountName: "Main" },
        },
        {
          id: "h2",
          name: "Beta Fund",
          symbol: "BETA",
          assetClass: "MUTUAL_FUND",
          currentValue: 400,
          pnl: -20,
          account: { provider: "broker", accountName: "Main" },
        },
      ] as never,
      [
        { id: "s1", capturedAt: new Date("2026-04-01"), value: 900, holding: { id: "h1" } },
        { id: "s2", capturedAt: new Date("2026-04-02"), value: 1000, holding: { id: "h1" } },
      ] as never,
    );

    expect(analytics.totalValue).toBe(1000);
    expect(analytics.totalPnl).toBe(40);
    expect(analytics.assetAllocation).toHaveLength(2);
    expect(analytics.assetAllocation[0]).toMatchObject({ label: "Stocks", value: 600 });
    expect(analytics.gainers[0].symbol).toBe("ALPHA");
    expect(analytics.losers[0].symbol).toBe("BETA");
    expect(analytics.snapshotTrend).toHaveLength(2);
  });

  it("detects credit cards from card statements and card instruments", () => {
    const cards = detectCreditCards(
      [
        {
          id: "parsed-1",
          amount: 12000,
          merchantName: null,
          paymentInstrument: "Card XX1234",
          confidence: 0.92,
          emailSource: {
            sentAt: new Date("2026-04-20T10:00:00"),
            fromAddress: "cards@hdfcbank.com",
            fromName: "HDFC Bank Cards",
            subject: "Your credit card statement for card ending 1234",
            snippet: "Total amount due is INR 12000",
          },
        },
      ],
      [
        {
          paymentInstrument: "Credit Card 9876",
          transactionDate: new Date("2026-04-21T10:00:00"),
          amount: 500,
          confidence: 0.8,
        },
      ] as never,
    );

    expect(cards).toHaveLength(2);
    expect(cards[0]).toMatchObject({ last4: "9876", latestAmount: 500 });
    expect(cards[1]).toMatchObject({ issuer: "HDFC Bank", last4: "1234", latestAmount: 12000 });
  });
});
