import { assetClassLabel, type HoldingView } from "@/lib/finance/portfolio";
import { shortDate } from "@/lib/format";
import { HoldingTableClient, type HoldingTableRow } from "./holding-table-client";

export function HoldingTable({ holdings }: { holdings: HoldingView[] }) {
  return <HoldingTableClient holdings={holdings.map(toHoldingRow)} />;
}

function toHoldingRow(holding: HoldingView): HoldingTableRow {
  return {
    id: holding.id,
    name: holding.name,
    symbol: holding.symbol,
    assetClass: assetClassLabel(holding.assetClass),
    quantity: holding.quantity.toLocaleString("en-IN", { maximumFractionDigits: 3 }),
    averagePrice: holding.averagePrice ?? 0,
    lastPrice: holding.lastPrice ?? 0,
    currentValue: holding.value,
    pnl: holding.pnl,
    pnlPct: holding.pnlPct ?? 0,
    account: holding.sector,
    updatedLabel: shortDate(holding.asOf),
    updatedIso: holding.asOf.toISOString(),
  };
}
