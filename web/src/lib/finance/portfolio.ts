import type { AssetClass, Holding, Position } from "@prisma/client";
import type { TenantDb } from "@/lib/db";
import { UNCLASSIFIED } from "@/lib/securities";

export type HoldingView = {
  id: string;
  symbol: string;
  name: string;
  assetClass: AssetClass;
  sector: string;
  exchange: string | null;
  quantity: number;
  averagePrice: number | null;
  lastPrice: number | null;
  value: number;
  invested: number;
  pnl: number;
  pnlPct: number | null;
  dayChange: number;
  weightPct: number;
  asOf: Date;
};

export type Slice = { label: string; value: number; pct: number; count: number };

export type PortfolioLimits = { singleStockLimitPct: number; sectorLimitPct: number };

const ASSET_CLASS_LABELS: Record<AssetClass, string> = {
  STOCK: "Stocks",
  MUTUAL_FUND: "Mutual funds",
  GOLD: "Gold",
  ETF: "ETFs",
  CASH: "Cash",
  OTHER: "Other",
};

export function assetClassLabel(value: AssetClass) {
  return ASSET_CLASS_LABELS[value] ?? value;
}

const n = (value: unknown) => (value === null || value === undefined ? null : Number(value));

export function toHoldingView(holding: Holding, total: number): HoldingView {
  const quantity = Number(holding.quantity);
  const value = n(holding.currentValue) ?? 0;
  const pnl = n(holding.pnl) ?? 0;
  return {
    id: holding.id,
    symbol: holding.symbol ?? holding.instrumentKey,
    name: holding.name,
    assetClass: holding.assetClass,
    sector: holding.sector ?? UNCLASSIFIED,
    exchange: holding.exchange,
    quantity,
    averagePrice: n(holding.averagePrice),
    lastPrice: n(holding.lastPrice),
    value,
    invested: value - pnl,
    pnl,
    pnlPct: n(holding.pnlPct),
    dayChange: n(holding.dayChange) ?? 0,
    weightPct: total > 0 ? (value / total) * 100 : 0,
    asOf: holding.asOf,
  };
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

/** Pure analytics over active holdings. Exported for tests. */
export function analyzePortfolio(holdings: Holding[], limits: PortfolioLimits) {
  const total = holdings.reduce((sum, item) => sum + (n(item.currentValue) ?? 0), 0);
  const views = holdings.map((holding) => toHoldingView(holding, total)).sort((a, b) => b.value - a.value);

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

  const weights = views.map((item) => item.weightPct / 100);
  const hhi = weights.reduce((sum, weight) => sum + weight * weight, 0);

  const overweightHoldings = views.filter((item) => item.assetClass === "STOCK" && item.weightPct > limits.singleStockLimitPct);
  const overweightSectors = sectors.filter((slice) => slice.label !== UNCLASSIFIED && slice.pct > limits.sectorLimitPct);
  const asOf = views.reduce<Date | null>((latest, item) => (!latest || item.asOf > latest ? item.asOf : latest), null);

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
    sectorCount: sectors.filter((slice) => slice.label !== UNCLASSIFIED).length,
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
    asOf,
    limits,
  };
}

export type PortfolioAnalysis = ReturnType<typeof analyzePortfolio>;

export async function getUserLimits(db: TenantDb, userId: string): Promise<PortfolioLimits> {
  const settings = await db.userSettings.findUnique({ where: { userId } });
  return {
    singleStockLimitPct: Number(settings?.singleStockLimitPct ?? 10),
    sectorLimitPct: Number(settings?.sectorLimitPct ?? 25),
  };
}

export async function getPortfolio(db: TenantDb, userId: string) {
  const [holdings, limits, positions] = await Promise.all([
    db.holding.findMany({ where: { closedAt: null } }),
    getUserLimits(db, userId),
    db.position.findMany({ orderBy: { symbol: "asc" } }),
  ]);
  return { ...analyzePortfolio(holdings, limits), positions: positions.map(toPositionView) };
}

export function toPositionView(position: Position) {
  return {
    symbol: position.symbol,
    exchange: position.exchange,
    product: position.product,
    quantity: Number(position.quantity),
    averagePrice: n(position.averagePrice),
    lastPrice: n(position.lastPrice),
    pnl: n(position.pnl) ?? 0,
    asOf: position.asOf,
  };
}

/** Daily total value and amount invested from snapshots, for the trend chart. */
export async function getValueHistory(db: TenantDb, days = 90) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const snapshots = await db.investmentSnapshot.findMany({
    where: { capturedAt: { gte: since } },
    select: { capturedAt: true, value: true, pnl: true, holdingId: true },
    orderBy: { capturedAt: "asc" },
  });
  // Keep the last snapshot per holding per day, then sum by day.
  const lastPerDay = new Map<string, Map<string, { value: number; pnl: number }>>();
  for (const snapshot of snapshots) {
    const day = snapshot.capturedAt.toISOString().slice(0, 10);
    const holdings = lastPerDay.get(day) ?? new Map<string, { value: number; pnl: number }>();
    holdings.set(snapshot.holdingId, { value: Number(snapshot.value ?? 0), pnl: Number(snapshot.pnl ?? 0) });
    lastPerDay.set(day, holdings);
  }
  return [...lastPerDay.entries()].map(([date, holdings]) => {
    let value = 0;
    let pnl = 0;
    for (const entry of holdings.values()) {
      value += entry.value;
      pnl += entry.pnl;
    }
    return { date, value, invested: value - pnl };
  });
}
