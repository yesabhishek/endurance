import type { Holding, Snapshot } from "@/lib/portfolio";
import { classifyEquity, classifyFund, sectorMap } from "@/lib/securities";
import { kiteApi, type KiteHolding, type KiteMfHolding } from "./client";

function round(value: number | null, places = 2) {
  if (value === null || !Number.isFinite(value)) return null;
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

export function normalizeEquity(raw: KiteHolding, sector: string | undefined): Holding {
  // Shares bought yesterday sit in t1_quantity until settlement; Kite shows them as held.
  const quantity = raw.quantity + (raw.t1_quantity ?? 0);
  const classified = classifyEquity(raw.tradingsymbol, raw.isin, sector);
  const lastPrice = raw.last_price ?? null;
  const averagePrice = raw.average_price ?? null;
  const value = lastPrice !== null ? quantity * lastPrice : 0;
  const invested = averagePrice !== null ? quantity * averagePrice : null;
  const pnl = raw.pnl ?? (invested !== null ? value - invested : 0);
  return {
    key: `${raw.exchange ?? "NSE"}:${raw.tradingsymbol}`,
    assetClass: classified.assetClass,
    symbol: raw.tradingsymbol,
    isin: raw.isin ?? null,
    name: raw.tradingsymbol,
    exchange: raw.exchange ?? null,
    sector: classified.sector,
    quantity,
    averagePrice,
    lastPrice,
    closePrice: raw.close_price ?? null,
    value: round(value) ?? 0,
    pnl: round(pnl) ?? 0,
    pnlPct: invested ? round((pnl / invested) * 100, 4) : null,
    dayChange: raw.day_change != null ? (round(raw.day_change * quantity) ?? 0) : 0,
  };
}

export function normalizeFund(raw: KiteMfHolding): Holding {
  const lastPrice = raw.last_price ?? null;
  const averagePrice = raw.average_price ?? null;
  const value = lastPrice !== null ? raw.quantity * lastPrice : 0;
  const invested = averagePrice !== null ? raw.quantity * averagePrice : null;
  const pnl = raw.pnl ?? (invested !== null ? value - invested : 0);
  const name = raw.fund?.trim() || raw.tradingsymbol;
  return {
    key: raw.folio ? `${raw.tradingsymbol}:${raw.folio}` : raw.tradingsymbol,
    assetClass: "MUTUAL_FUND",
    symbol: raw.tradingsymbol,
    isin: raw.tradingsymbol,
    name,
    exchange: null,
    sector: classifyFund(name),
    quantity: raw.quantity,
    averagePrice,
    lastPrice,
    closePrice: null,
    value: round(value) ?? 0,
    pnl: round(pnl) ?? 0,
    pnlPct: invested ? round((pnl / invested) * 100, 4) : null,
    dayChange: 0,
  };
}

/** Reads holdings, mutual funds, positions and margins. Only GET endpoints; nothing is ever changed on Kite. */
export async function fetchSnapshot(session: { apiKey: string; accessToken: string; userId: string; userName: string }): Promise<Snapshot> {
  const kite = kiteApi(session.apiKey, session.accessToken);
  const [equity, funds, positions, availableFunds, sectors] = await Promise.all([
    kite.holdings(),
    kite.mfHoldings(),
    kite.positions(),
    kite.availableFunds().catch(() => null),
    sectorMap(),
  ]);

  const holdings = [
    ...equity.filter((item) => item.quantity + (item.t1_quantity ?? 0) > 0).map((item) => normalizeEquity(item, item.isin ? sectors.get(item.isin) : undefined)),
    ...funds.filter((item) => item.quantity > 0).map(normalizeFund),
  ];

  return {
    asOf: new Date().toISOString(),
    source: "kite",
    account: { userId: session.userId, userName: session.userName },
    holdings,
    positions: positions.map((position) => ({
      symbol: position.tradingsymbol,
      exchange: position.exchange ?? null,
      product: position.product ?? null,
      quantity: position.quantity,
      averagePrice: position.average_price ?? null,
      lastPrice: position.last_price ?? null,
      pnl: position.pnl ?? 0,
    })),
    availableFunds,
  };
}
