// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SetupChecklist } from "./setup-checklist";

describe("SetupChecklist", () => {
  it("shows both setup tasks before the app is unlocked", () => {
    render(<SetupChecklist spendingConnected={false} investmentConnected={false} />);

    expect(screen.getByText("Connect Spending Data")).toBeInTheDocument();
    expect(screen.getByText("Connect Investment Data")).toBeInTheDocument();
    expect(screen.getByText("Connect at least one data source to continue into the app.")).toBeInTheDocument();
  });

  it("shows a manage action for completed sources", () => {
    render(<SetupChecklist spendingConnected investmentConnected={false} />);

    expect(screen.getByText("Manage")).toBeInTheDocument();
    expect(screen.getAllByText("Connect")).toHaveLength(1);
  });
});
