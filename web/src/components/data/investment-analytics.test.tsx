// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { InvestmentAnalytics } from "./investment-analytics";

describe("InvestmentAnalytics", () => {
  it("focuses on asset allocation and movers", () => {
    render(
      <InvestmentAnalytics
        analytics={{
          assetAllocation: [{ label: "Mutual Funds", value: 1000, pct: 100 }],
          gainers: [],
          losers: [],
        }}
      />,
    );

    expect(screen.getByText("Asset allocation")).toBeInTheDocument();
    expect(screen.getByText("Mutual Funds")).toBeInTheDocument();
    expect(screen.queryByText("Account allocation")).not.toBeInTheDocument();
    expect(screen.queryByText("Concentration")).not.toBeInTheDocument();
  });
});
