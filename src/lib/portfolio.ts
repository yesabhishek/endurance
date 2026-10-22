import type { Limits } from "./config";

export const UNCLASSIFIED = "Unclassified";

export type AssetClass = "STOCK" | "MUTUAL_FUND" | "ETF" | "GOLD";

/** One holding as Kite reported it, with the sector or fund category we assigned. */
export type Holding = {
  key: string;
  assetClass: AssetClass;
  symbol: string;
  isin: string | null;
  name: string;
  exchange: string | null;
  sector: string;
  quantity: number;
  averagePrice: number | null;
  lastPrice: number | null;
  closePrice: number | null;
  value: number;
  pnl: number;
  pnlPct: number | null;
  dayChange: number;
};

export type Position = {
  symbol: string;
  exchange: string | null;
  product: string | null;
  quantity: number;
  averagePrice: number | null;
  lastPrice: number | null;
  pnl: number;
};

/** Everything Endurance knows about the portfolio at one moment. Saved to .data/portfolio.json. */
export type Snapshot = {
  asOf: string;
  source: "kite" | "demo";
  account: { userId: string; userName: string };
  holdings: Holding[];
  positions: Position[];
  /** Kite equity segment net margin: cash you could deploy. Null when Kite didn't return it. */
  availableFunds: number | null;
};

export type HistoryPoint = { date: string; value: number; invested: number };

export type HoldingView = Holding & { invested: number; weightPct: number; dayPct: number };

export type Slice = { label: string; value: number; pct: number; count: number };

const ASSET_CLASS_LABELS: Record<AssetClass, string> = {
  STOCK: "Stocks",
  MUTUAL_FUND: "Mutual funds",
  ETF: "ETFs",
  GOLD: "Gold",
};

export function assetClassLabel(value: AssetClass) {
  return ASSET_CLASS_LABELS[value] ?? value;
}

/** Short display name: the symbol for exchange-traded holdings, the scheme name for funds. */
export function shortName(holding: Pick<Holding, "assetClass" | "name" | "symbol">) {
  return holding.assetClass === "MUTUAL_FUND" ? holding.name.split(" - ")[0].replace(/\s+fund$/i, "") : holding.symbol;
}

function group(items: HoldingView[], key: (item: HoldingView) => string, total: number): Slice[] {
  const map = new Map<string, { value: number; count: number }>();
  for (const item of items) {
    const label = key(item);
    const entry = map.get(label) ?? { value: 0, count: 0 };
    entry.value += item.value;
    entry.count += 1;
    map.set(label, entry);
  }
  return [...map.entries()]
    .map(([label, entry]) => ({ label, value: entry.value, count: entry.count, pct: total > 0 ? (entry.value / total) * 100 : 0 }))
    .sort((a, b) => b.value - a.value);
}

/** Pure analytics over current holdings. Every number the dashboard and the assistant show comes from here. */
export function analyzePortfolio(holdings: Holding[], limits: Limits) {
  const total = holdings.reduce((sum, item) => sum + item.value, 0);
  const views: HoldingView[] = holdings
    .map((holding) => {
      const previous = holding.value - holding.dayChange;
      return {
        ...holding,
        invested: holding.value - holding.pnl,
        weightPct: total > 0 ? (holding.value / total) * 100 : 0,
        dayPct: previous > 0 ? (holding.dayChange / previous) * 100 : 0,
      };
    })
    .sort((a, b) => b.value - a.value);

  const totalPnl = views.reduce((sum, item) => sum + item.pnl, 0);
  const invested = total - totalPnl;
  const dayChange = views.reduce((sum, item) => sum + item.dayChange, 0);
  const previousValue = total - dayChange;

  // Sector exposure covers direct equity (stocks). Funds and ETFs are shown by category.
  const equity = views.filter((item) => item.assetClass === "STOCK");
  const equityTotal = equity.reduce((sum, item) => sum + item.value, 0);
  const sectors = group(equity, (item) => item.sector, equityTotal);
  const fundCategories = group(
    views.filter((item) => item.assetClass !== "STOCK"),
    (item) => item.sector,
    total - equityTotal,
  );
  const assetClasses = group(views, (item) => assetClassLabel(item.assetClass), total);

  const hhi = views.reduce((sum, item) => sum + (item.weightPct / 100) ** 2, 0);

  const overweightHoldings = views.filter((item) => item.assetClass === "STOCK" && item.weightPct > limits.singleStockLimitPct);
  const overweightSectors = sectors.filter((slice) => slice.label !== UNCLASSIFIED && slice.pct > limits.sectorLimitPct);

  return {
    total,
    invested,
    totalPnl,
    totalPnlPct: invested > 0 ? (totalPnl / invested) * 100 : 0,
    dayChange,
    dayChangePct: previousValue > 0 ? (dayChange / previousValue) * 100 : 0,
    holdings: views,
    equityTotal,
    sectors,
    unclassified: sectors.find((slice) => slice.label === UNCLASSIFIED) ?? null,
    fundCategories,
    assetClasses,
    concentration: {
      topHoldingPct: views[0]?.weightPct ?? 0,
      top5Pct: views.slice(0, 5).reduce((sum, item) => sum + item.weightPct, 0),
      // Effective number of equally weighted positions (1 / HHI).
      effectivePositions: hhi > 0 ? 1 / hhi : 0,
    },
    breaches: { overweightHoldings, overweightSectors },
    limits,
  };
}

export type PortfolioAnalysis = ReturnType<typeof analyzePortfolio>;
