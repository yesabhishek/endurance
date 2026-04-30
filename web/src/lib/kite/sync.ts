import { getDb } from "@/lib/db";
import { asArray, callKiteTool, isInvalidMcpSessionError, isMcpAuthRequired } from "./mcp";

type KiteHolding = Record<string, unknown>;

type KiteSyncOptions = {
  syncRunId?: string;
};

export async function syncKitePortfolio(options: KiteSyncOptions = {}) {
  const db = getDb();
  const syncRun = options.syncRunId
    ? await db.syncRun.update({
        where: { id: options.syncRunId },
        data: {
          status: "RUNNING",
          finishedAt: null,
          error: null,
        },
      })
    : await db.syncRun.create({
        data: { source: "KITE", status: "RUNNING" },
      });

  try {
    const sessionId = await getStoredKiteSessionId();
    if (!sessionId) {
      throw new Error("Investment Data is not connected. Use Settings to connect it first.");
    }

    const [profile, holdingsResult, mfHoldingsResult] = await Promise.all([
      callKiteTool("get_profile", {}, sessionId).catch((error) => ({ data: { error: String(error) } })),
      callKiteTool("get_holdings", {}, sessionId).catch((error) => ({ data: { error: String(error) } })),
      callKiteTool("get_mf_holdings", {}, sessionId).catch((error) => ({ data: { error: String(error) } })),
    ]);

    if (
      isInvalidMcpSessionError(errorText(profile.data)) ||
      isInvalidMcpSessionError(errorText(holdingsResult.data)) ||
      isInvalidMcpSessionError(errorText(mfHoldingsResult.data))
    ) {
      await clearKiteSessionId();
      throw new Error("Investment Data connection expired. Use Settings to reconnect it.");
    }

    if (isMcpAuthRequired(profile.data) || isMcpAuthRequired(holdingsResult.data) || isMcpAuthRequired(mfHoldingsResult.data)) {
      throw new Error("Investment Data requires login. Use Settings to reconnect it, then update again.");
    }

    if (hasError(holdingsResult.data) && hasError(mfHoldingsResult.data)) {
      throw new Error(`${holdingsResult.data.error}; ${mfHoldingsResult.data.error}`);
    }

    const account = await db.investmentAccount.upsert({
      where: { provider_accountRef: { provider: "kite", accountRef: "default" } },
      update: {
        accountName: stringField(profile.data, "user_name") ?? stringField(profile.data, "user_id") ?? "Kite",
      },
      create: {
        provider: "kite",
        accountRef: "default",
        accountName: stringField(profile.data, "user_name") ?? stringField(profile.data, "user_id") ?? "Kite",
      },
    });

    const holdings = asArray(holdingsResult.data);
    const mfHoldings = asArray(mfHoldingsResult.data);
    let inserted = 0;
    let updated = 0;

    const totalItems = holdings.length + mfHoldings.length;
    let scanned = 0;

    for (const holding of holdings) {
      const changed = await upsertHolding(account.id, holding as KiteHolding, "STOCK");
      if (changed === "inserted") inserted += 1;
      else updated += 1;
      scanned += 1;
      await updateSyncProgress(syncRun.id, scanned, inserted, updated, totalItems);
    }

    for (const holding of mfHoldings) {
      const changed = await upsertHolding(account.id, holding as KiteHolding, "MUTUAL_FUND");
      if (changed === "inserted") inserted += 1;
      else updated += 1;
      scanned += 1;
      await updateSyncProgress(syncRun.id, scanned, inserted, updated, totalItems);
    }

    return await db.syncRun.update({
      where: { id: syncRun.id },
      data: {
        status: "SUCCESS",
        finishedAt: new Date(),
        scanned: holdings.length + mfHoldings.length,
        inserted,
        updated,
      },
    });
  } catch (error) {
    const failedRun = await db.syncRun.update({
      where: { id: syncRun.id },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        error: error instanceof Error ? error.message : "Unknown Investment Data update error",
      },
    });
    throw new Error(failedRun.error ?? "Unknown Investment Data update error");
  }
}

async function updateSyncProgress(syncRunId: string, scanned: number, inserted: number, updated: number, totalItems: number) {
  if (scanned % 10 !== 0 && scanned !== totalItems) return;
  await getDb().syncRun.update({
    where: { id: syncRunId },
    data: { scanned, inserted, updated },
  });
}

export async function getStoredKiteSessionId() {
  const account = await getDb().connectedAccount.findFirst({
    where: { provider: "KITE", accountEmail: "local" },
  });
  return account?.scope ?? process.env.KITE_MCP_SESSION_ID ?? null;
}

export async function storeKiteSessionId(sessionId: string | undefined) {
  if (!sessionId) return;

  await getDb().connectedAccount.upsert({
    where: {
      provider_accountEmail: {
        provider: "KITE",
        accountEmail: "local",
      },
    },
    update: {
      displayName: "Investment Data",
      status: "connected",
      scope: sessionId,
    },
    create: {
      provider: "KITE",
      accountEmail: "local",
      displayName: "Investment Data",
      status: "connected",
      scope: sessionId,
    },
  });
}

export async function clearKiteSessionId() {
  await getDb().connectedAccount.updateMany({
    where: { provider: "KITE", accountEmail: "local" },
    data: { scope: null, status: "login_required" },
  });
}

function errorText(value: unknown) {
  if (value && typeof value === "object" && "error" in value) {
    return String((value as { error: unknown }).error);
  }
  return value;
}

async function upsertHolding(accountId: string, raw: KiteHolding, assetClass: "STOCK" | "MUTUAL_FUND") {
  const db = getDb();
  const symbol = stringField(raw, "tradingsymbol") ?? stringField(raw, "symbol") ?? stringField(raw, "isin");
  const name =
    stringField(raw, "name") ??
    stringField(raw, "fund") ??
    stringField(raw, "scheme_name") ??
    symbol ??
    "Unknown holding";
  const quantity = numericField(raw, "quantity") ?? numericField(raw, "units") ?? 0;
  const averagePrice = numericField(raw, "average_price") ?? numericField(raw, "average_nav");
  const lastPrice = numericField(raw, "last_price") ?? numericField(raw, "last_price") ?? numericField(raw, "last_nav");
  const currentValue =
    numericField(raw, "current_value") ??
    numericField(raw, "market_value") ??
    (lastPrice !== null ? quantity * lastPrice : null);
  const pnl = numericField(raw, "pnl") ?? numericField(raw, "profit");
  const normalizedSymbol = symbol ?? name;

  const existing = await db.holding.findFirst({
    where: { accountId, source: "kite", assetClass, name, symbol: normalizedSymbol },
  });

  const holding = await db.holding.upsert({
    where: {
      accountId_source_assetClass_name_symbol: {
        accountId,
        source: "kite",
        assetClass,
        name,
        symbol: normalizedSymbol,
      },
    },
    update: {
      isin: stringField(raw, "isin"),
      exchange: stringField(raw, "exchange"),
      quantity,
      averagePrice,
      lastPrice,
      currentValue,
      pnl,
      pnlPct: averagePrice && lastPrice ? ((lastPrice - averagePrice) / averagePrice) * 100 : null,
      asOf: new Date(),
      metadataJson: JSON.stringify(raw),
    },
    create: {
      accountId,
      source: "kite",
      assetClass,
      symbol: normalizedSymbol,
      isin: stringField(raw, "isin"),
      name,
      exchange: stringField(raw, "exchange"),
      quantity,
      averagePrice,
      lastPrice,
      currentValue,
      pnl,
      pnlPct: averagePrice && lastPrice ? ((lastPrice - averagePrice) / averagePrice) * 100 : null,
      metadataJson: JSON.stringify(raw),
    },
  });

  await db.investmentSnapshot.create({
    data: {
      holdingId: holding.id,
      source: "kite",
      quantity,
      price: lastPrice,
      value: currentValue,
      pnl,
      metadataJson: JSON.stringify(raw),
    },
  });

  return existing ? "updated" : "inserted";
}

function hasError(value: unknown): value is { error: string } {
  return Boolean(value && typeof value === "object" && "error" in value);
}

function stringField(value: unknown, key: string) {
  if (!value || typeof value !== "object") return null;
  const item = (value as Record<string, unknown>)[key];
  return typeof item === "string" && item.trim() ? item.trim() : null;
}

function numericField(value: unknown, key: string) {
  if (!value || typeof value !== "object") return null;
  const item = (value as Record<string, unknown>)[key];
  if (typeof item === "number" && Number.isFinite(item)) return item;
  if (typeof item === "string" && item.trim() && Number.isFinite(Number(item))) return Number(item);
  return null;
}
