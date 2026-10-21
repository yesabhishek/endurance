import type { AssetClass, SyncRun } from "@prisma/client";
import { tenantDb, type TenantDb } from "@/lib/db";
import { classifyEquity, classifyFund, ensureSecurityMaster, sectorsByIsin } from "@/lib/securities";
import { KiteError, kiteApi, type KiteHolding, type KiteMfHolding } from "./client";
import { getKiteSession, markKiteExpired } from "./connection";

type NormalizedHolding = {
  assetClass: AssetClass;
  instrumentKey: string;
  symbol: string;
  isin: string | null;
  name: string;
  exchange: string | null;
  sector: string;
  quantity: number;
  averagePrice: number | null;
  lastPrice: number | null;
  closePrice: number | null;
  currentValue: number | null;
  pnl: number | null;
  pnlPct: number | null;
  dayChange: number | null;
};

export class KiteReconnectRequired extends Error {
  constructor() {
    super("Your Kite session has expired. Kite requires a fresh login every day; reconnect from Settings.");
  }
}

function round(value: number | null, places = 2) {
  if (value === null || !Number.isFinite(value)) return null;
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

export function normalizeEquity(raw: KiteHolding, sector: string | undefined): NormalizedHolding {
  // Shares bought yesterday sit in t1_quantity until settlement; Kite shows them as held.
  const quantity = raw.quantity + (raw.t1_quantity ?? 0);
  const classified = classifyEquity(raw.tradingsymbol, raw.isin, sector);
  const lastPrice = raw.last_price ?? null;
  const averagePrice = raw.average_price ?? null;
  const currentValue = lastPrice !== null ? quantity * lastPrice : null;
  const invested = averagePrice !== null ? quantity * averagePrice : null;
  const pnl = raw.pnl ?? (currentValue !== null && invested !== null ? currentValue - invested : null);
  return {
    assetClass: classified.assetClass,
    instrumentKey: `${raw.exchange ?? "NSE"}:${raw.tradingsymbol}`,
    symbol: raw.tradingsymbol,
    isin: raw.isin ?? null,
    name: raw.tradingsymbol,
    exchange: raw.exchange ?? null,
    sector: classified.sector,
    quantity,
    averagePrice,
    lastPrice,
    closePrice: raw.close_price ?? null,
    currentValue: round(currentValue),
    pnl: round(pnl),
    pnlPct: invested && pnl !== null ? round((pnl / invested) * 100, 4) : null,
    dayChange: raw.day_change != null ? round(raw.day_change * quantity) : null,
  };
}

export function normalizeFund(raw: KiteMfHolding): NormalizedHolding {
  const lastPrice = raw.last_price ?? null;
  const averagePrice = raw.average_price ?? null;
  const currentValue = lastPrice !== null ? raw.quantity * lastPrice : null;
  const invested = averagePrice !== null ? raw.quantity * averagePrice : null;
  const pnl = raw.pnl ?? (currentValue !== null && invested !== null ? currentValue - invested : null);
  const name = raw.fund?.trim() || raw.tradingsymbol;
  return {
    assetClass: "MUTUAL_FUND",
    instrumentKey: raw.folio ? `${raw.tradingsymbol}:${raw.folio}` : raw.tradingsymbol,
    symbol: raw.tradingsymbol,
    isin: raw.tradingsymbol,
    name,
    exchange: null,
    sector: classifyFund(name),
    quantity: raw.quantity,
    averagePrice,
    lastPrice,
    closePrice: null,
    currentValue: round(currentValue),
    pnl: round(pnl),
    pnlPct: invested && pnl !== null ? round((pnl / invested) * 100, 4) : null,
    dayChange: null,
  };
}

async function upsertHoldings(db: TenantDb, userId: string, accountId: string, holdings: NormalizedHolding[], syncedAt: Date) {
  let inserted = 0;
  let updated = 0;
  for (const holding of holdings) {
    const where = { accountId_assetClass_instrumentKey: { accountId, assetClass: holding.assetClass, instrumentKey: holding.instrumentKey } };
    const existing = await db.holding.findUnique({ where, select: { id: true } });
    const data = {
      source: "kite",
      symbol: holding.symbol,
      isin: holding.isin,
      name: holding.name,
      exchange: holding.exchange,
      sector: holding.sector,
      quantity: holding.quantity,
      averagePrice: holding.averagePrice,
      lastPrice: holding.lastPrice,
      closePrice: holding.closePrice,
      currentValue: holding.currentValue,
      pnl: holding.pnl,
      pnlPct: holding.pnlPct,
      dayChange: holding.dayChange,
      asOf: syncedAt,
      closedAt: null,
    };
    const saved = await db.holding.upsert({
      where,
      update: data,
      create: { userId, accountId, assetClass: holding.assetClass, instrumentKey: holding.instrumentKey, ...data },
      select: { id: true },
    });
    await db.investmentSnapshot.create({
      data: {
        userId,
        holdingId: saved.id,
        source: "kite",
        capturedAt: syncedAt,
        quantity: holding.quantity,
        price: holding.lastPrice,
        value: holding.currentValue,
        pnl: holding.pnl,
      },
    });
    if (existing) updated += 1;
    else inserted += 1;
  }
  return { inserted, updated };
}

/** Pulls holdings, mutual funds and positions for one user. Read-only on Kite's side. */
export async function syncKitePortfolio({ userId, syncRunId }: { userId: string; syncRunId: string }): Promise<SyncRun> {
  const db = tenantDb(userId);
  await db.syncRun.update({ where: { id: syncRunId }, data: { status: "RUNNING", finishedAt: null, error: null } });

  try {
    const session = await getKiteSession(db, userId);
    if (!session) throw new KiteReconnectRequired();
    await db.syncRun.update({ where: { id: syncRunId }, data: { connectedAccountId: session.account.id } });

    const kite = kiteApi(session.apiKey, session.accessToken);
    let equity: KiteHolding[];
    let funds: KiteMfHolding[];
    let positions: Awaited<ReturnType<typeof kite.positions>>;
    try {
      [equity, funds, positions] = await Promise.all([kite.holdings(), kite.mfHoldings(), kite.positions()]);
    } catch (error) {
      if (error instanceof KiteError && error.isTokenExpired) {
        await markKiteExpired(db, userId, session.account.id);
        throw new KiteReconnectRequired();
      }
      throw error;
    }

    await ensureSecurityMaster();
    const sectors = await sectorsByIsin(equity.map((item) => item.isin ?? ""));
    const normalized = [
      ...equity.filter((item) => item.quantity + (item.t1_quantity ?? 0) > 0).map((item) => normalizeEquity(item, item.isin ? sectors.get(item.isin) : undefined)),
      ...funds.filter((item) => item.quantity > 0).map(normalizeFund),
    ];

    const account = await db.investmentAccount.upsert({
      where: { userId_provider_accountRef: { userId, provider: "kite", accountRef: session.account.externalId } },
      update: { accountName: session.account.displayName },
      create: { userId, provider: "kite", accountRef: session.account.externalId, accountName: session.account.displayName },
    });

    const syncedAt = new Date();
    const counts = await upsertHoldings(db, userId, account.id, normalized, syncedAt);

    // Anything Kite no longer reports has been sold or redeemed.
    await db.holding.updateMany({
      where: { accountId: account.id, closedAt: null, asOf: { lt: syncedAt } },
      data: { closedAt: syncedAt },
    });

    await db.position.deleteMany({ where: { accountId: account.id } });
    if (positions.length) {
      await db.position.createMany({
        data: positions.map((position) => ({
          userId,
          accountId: account.id,
          symbol: position.tradingsymbol,
          exchange: position.exchange ?? null,
          product: position.product ?? null,
          quantity: position.quantity,
          averagePrice: position.average_price ?? null,
          lastPrice: position.last_price ?? null,
          pnl: position.pnl ?? null,
          asOf: syncedAt,
        })),
      });
    }

    return await db.syncRun.update({
      where: { id: syncRunId },
      data: { status: "SUCCESS", finishedAt: new Date(), scanned: normalized.length + positions.length, ...counts },
    });
  } catch (error) {
    const message = error instanceof KiteReconnectRequired || error instanceof KiteError ? error.message : "Investment data could not be updated.";
    if (!(error instanceof KiteReconnectRequired)) console.error("[kite-sync] failed", error);
    await db.syncRun.update({ where: { id: syncRunId }, data: { status: "FAILED", finishedAt: new Date(), error: message } });
    throw error;
  }
}
