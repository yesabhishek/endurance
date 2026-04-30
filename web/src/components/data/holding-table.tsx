import type { Holding, InvestmentAccount } from "@prisma/client";
import { shortDate } from "@/lib/format";
import { HoldingTableClient, type HoldingTableRow } from "./holding-table-client";

type HoldingWithAccount = Holding & { account?: InvestmentAccount | null };

export function HoldingTable({ holdings }: { holdings: HoldingWithAccount[] }) {
  return <HoldingTableClient holdings={holdings.map(toHoldingRow)} />;
}

function toHoldingRow(holding: HoldingWithAccount): HoldingTableRow {
  return {
    id: holding.id,
    name: holding.name,
    symbol: holding.symbol ?? holding.name,
    assetClass: formatAssetClass(holding.assetClass),
    quantity: String(holding.quantity),
    averagePrice: Number(holding.averagePrice ?? 0),
    lastPrice: Number(holding.lastPrice ?? 0),
    currentValue: Number(holding.currentValue ?? 0),
    pnl: Number(holding.pnl ?? 0),
    pnlPct: Number(holding.pnlPct ?? 0),
    account: holding.account?.accountName ?? holding.account?.provider ?? "Investment account",
    updatedLabel: shortDate(holding.asOf),
    updatedIso: holding.asOf.toISOString(),
  };
}

function formatAssetClass(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
