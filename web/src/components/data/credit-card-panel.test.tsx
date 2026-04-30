// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CreditCardPanel } from "./credit-card-panel";

describe("CreditCardPanel", () => {
  it("shows detected cards instead of source records", () => {
    render(
      <CreditCardPanel
        cards={[
          {
            id: "hdfc-1234",
            issuer: "HDFC Bank",
            displayName: "HDFC Bank •••• 1234",
            last4: "1234",
            latestAmount: 12000,
            latestSeenAt: new Date("2026-04-20T10:00:00"),
            sourceCount: 3,
            confidence: 0.92,
          },
        ]}
      />,
    );

    expect(screen.getByText("Credit cards")).toBeInTheDocument();
    expect(screen.getByText("HDFC Bank •••• 1234")).toBeInTheDocument();
    expect(screen.queryByText("Recent source records")).not.toBeInTheDocument();
  });
});
