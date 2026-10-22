// Display names for the assistant's tools. Kept apart from tools.ts so the
// browser bundle doesn't pull in the tool implementations.
export const TOOL_TITLES: Record<string, string> = {
  portfolio_summary: "Portfolio summary",
  list_holdings: "Holdings",
  allocation: "Allocation",
  risk_checks: "Risk checks",
  open_positions: "Open positions",
  value_history: "Value history",
  what_if: "What-if calculation",
};
