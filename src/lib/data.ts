import { isDemo, limits } from "./config";
import { demoHistory, demoSnapshot } from "./demo";
import { KiteError } from "./kite/client";
import { activeSession, kiteStatus, markExpired, type KiteStatus } from "./kite/session";
import { fetchSnapshot } from "./kite/sync";
import { analyzePortfolio, type HistoryPoint, type Snapshot } from "./portfolio";
import { readJson, writeJson } from "./store";

// The one place pages and the assistant get portfolio data from. A fresh read
// from Kite takes about a second, so we reuse the saved snapshot for a couple of
// minutes and fall back to it whenever Kite can't be reached.

const SNAPSHOT_FILE = "portfolio.json";
const HISTORY_FILE = "history.json";
const MAX_AGE_MS = 2 * 60 * 1000;

let inflight: Promise<Snapshot> | null = null;

const istDate = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date(iso));

async function recordHistory(snapshot: Snapshot) {
  const analysis = analyzePortfolio(snapshot.holdings, limits());
  const history = (await readJson<HistoryPoint[]>(HISTORY_FILE)) ?? [];
  const date = istDate(snapshot.asOf);
  const point = { date, value: Math.round(analysis.total * 100) / 100, invested: Math.round(analysis.invested * 100) / 100 };
  const next = history.filter((entry) => entry.date !== date);
  next.push(point);
  next.sort((a, b) => a.date.localeCompare(b.date));
  await writeJson(HISTORY_FILE, next);
}

/** Pulls a fresh snapshot from Kite and saves it. Concurrent callers share one request. */
export function refreshFromKite(): Promise<Snapshot> {
  inflight ??= (async () => {
    const session = await activeSession();
    if (!session) throw new KiteError("Log in to Kite to load your portfolio.", "TokenException", 403);
    try {
      const snapshot = await fetchSnapshot(session);
      await writeJson(SNAPSHOT_FILE, snapshot);
      await recordHistory(snapshot);
      return snapshot;
    } catch (error) {
      if (error instanceof KiteError && error.isTokenExpired) await markExpired();
      throw error;
    }
  })().finally(() => {
    inflight = null;
  });
  return inflight;
}

export type PortfolioData = {
  snapshot: Snapshot | null;
  status: KiteStatus;
  /** Set when a refresh was attempted and failed; the saved snapshot (if any) is shown instead. */
  error: string | null;
};

export async function getPortfolioData(options: { maxAgeMs?: number } = {}): Promise<PortfolioData> {
  if (isDemo()) return { snapshot: demoSnapshot(), status: await kiteStatus(), error: null };

  const saved = await readJson<Snapshot>(SNAPSHOT_FILE);
  const status = await kiteStatus();
  const maxAge = options.maxAgeMs ?? MAX_AGE_MS;
  const stale = !saved || Date.now() - Date.parse(saved.asOf) > maxAge;

  if (status.state !== "connected" || !stale) return { snapshot: saved, status, error: null };

  try {
    return { snapshot: await refreshFromKite(), status, error: null };
  } catch (error) {
    const message = error instanceof KiteError ? error.message : "Kite could not be reached.";
    if (!(error instanceof KiteError)) console.error("[kite] refresh failed", error);
    return { snapshot: saved, status: await kiteStatus(), error: message };
  }
}

export async function getHistory(): Promise<HistoryPoint[]> {
  if (isDemo()) return demoHistory();
  return (await readJson<HistoryPoint[]>(HISTORY_FILE)) ?? [];
}
