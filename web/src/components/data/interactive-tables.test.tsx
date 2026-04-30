// @vitest-environment jsdom

import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HoldingTableClient, type HoldingTableRow } from "./holding-table-client";
import { TransactionTableClient, type TransactionTableRow } from "./transaction-table-client";

const transactions: TransactionTableRow[] = [
  {
    id: "txn-1",
    dateIso: "2026-04-29T10:00:00.000Z",
    dateLabel: "29 Apr 2026",
    merchantName: "Coffee Bar",
    category: "Food",
    instrument: "UPI",
    amount: 500,
    direction: "DEBIT",
    description: "Coffee",
    account: "me@example.com",
    confidence: 0.9,
    reference: "txn-1",
  },
  {
    id: "txn-2",
    dateIso: "2026-04-30T10:00:00.000Z",
    dateLabel: "30 Apr 2026",
    merchantName: "HDFC Bank Insta",
    category: "Shopping",
    instrument: "Card 1234",
    amount: 90000,
    direction: "DEBIT",
    description: "Purchase",
    account: "me@example.com",
    confidence: 0.95,
    reference: "txn-2",
  },
];

const holdings: HoldingTableRow[] = [
  {
    id: "holding-1",
    name: "Alpha Industries",
    symbol: "ALPHA",
    assetClass: "Stocks",
    quantity: "10",
    averagePrice: 100,
    lastPrice: 120,
    currentValue: 1200,
    pnl: 200,
    pnlPct: 20,
    account: "Broker",
    updatedLabel: "30 Apr 2026",
    updatedIso: "2026-04-30T10:00:00.000Z",
  },
  {
    id: "holding-2",
    name: "Beta Fund",
    symbol: "BETA",
    assetClass: "Mutual Funds",
    quantity: "5",
    averagePrice: 100,
    lastPrice: 90,
    currentValue: 450,
    pnl: -50,
    pnlPct: -10,
    account: "Broker",
    updatedLabel: "29 Apr 2026",
    updatedIso: "2026-04-29T10:00:00.000Z",
  },
];

describe("interactive finance tables", () => {
  it("searches and sorts transactions", () => {
    render(<TransactionTableClient transactions={transactions} />);

    fireEvent.change(screen.getByLabelText("Search transactions"), { target: { value: "coffee" } });
    expect(screen.getByText("Coffee Bar")).toBeInTheDocument();
    expect(screen.queryByText("HDFC Bank Insta")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Search transactions"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: /Amount/i }));

    const rows = screen.getAllByRole("row").slice(1);
    expect(within(rows[0]).getByText("HDFC Bank Insta")).toBeInTheDocument();
  });

  it("searches and sorts holdings while showing impact colors", () => {
    render(<HoldingTableClient holdings={holdings} />);

    expect(screen.getByText("Alpha Industries")).toHaveClass("font-semibold");
    expect(screen.getByText("₹200.00 · 20.00%")).toHaveClass("text-emerald-700");
    expect(screen.getByText("-₹50.00 · -10.00%")).toHaveClass("text-red-700");

    fireEvent.change(screen.getByLabelText("Search holdings"), { target: { value: "beta" } });
    expect(screen.getByText("Beta Fund")).toBeInTheDocument();
    expect(screen.queryByText("Alpha Industries")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Search holdings"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: /Asset/i }));

    const rows = screen.getAllByRole("row").slice(1);
    expect(within(rows[0]).getByText("Alpha Industries")).toBeInTheDocument();
  });
});
