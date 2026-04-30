// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ExpenseAnalytics } from "./expense-analytics";

const range = {
  preset: "month" as const,
  from: new Date("2026-04-01T00:00:00"),
  to: new Date("2026-04-03T23:59:59"),
};

const analytics = {
  dailySpend: [
    { date: "2026-04-01", amount: 500, transactionCount: 1 },
    { date: "2026-04-02", amount: 1500, transactionCount: 2 },
    { date: "2026-04-03", amount: 0, transactionCount: 0 },
  ],
  maxDailySpend: 1500,
  categoryBreakdown: [{ label: "Food", value: 500, pct: 25 }],
  merchantBreakdown: [{ label: "Coffee Bar", value: 500, pct: 25 }],
  subscriptions: [
    {
      id: "sub-1",
      name: "Streaming",
      amount: 1200,
      cadence: "monthly",
      status: "ACTIVE",
      lastSeenAt: "2026-04-02T10:00:00",
    },
  ],
  subscriptionTotal: 1200,
};

describe("ExpenseAnalytics", () => {
  it("renders interactive heatmap cells and selected day summary", () => {
    render(<ExpenseAnalytics range={range} analytics={analytics} />);

    const cell = screen.getAllByLabelText("2026-04-02: ₹1,500.00, 2 transactions").at(-1);
    expect(cell).toBeDefined();
    fireEvent.click(cell!);

    expect(screen.getAllByText("02 Apr 2026").length).toBeGreaterThan(0);
    expect(screen.getAllByText("2 transactions").length).toBeGreaterThan(0);
  });

  it("shows subscriptions instead of bill forecast", () => {
    render(<ExpenseAnalytics range={range} analytics={analytics} />);

    expect(screen.getByText("Subscriptions")).toBeInTheDocument();
    expect(screen.getByText("Streaming")).toBeInTheDocument();
    expect(screen.queryByText("Bills forecast")).not.toBeInTheDocument();
  });
});
