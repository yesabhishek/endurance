/**
 * Fills a development database with a sample Zerodha portfolio so the dashboard
 * can be built and reviewed without a Kite account.
 *
 *   npm run seed:demo
 *
 * Signs in as demo@endurance.local with DEMO_PASSWORD (default below). Refuses to
 * run when NODE_ENV=production, and only ever touches the demo user's rows.
 */
import type { AssetClass } from "@prisma/client";
import { hashPassword } from "@/lib/auth/password";
import { saveCredential } from "@/lib/credentials";
import { getDb, tenantDb } from "@/lib/db";
import { storeKiteSession } from "@/lib/kite/connection";

const DEMO_EMAIL = "demo@endurance.local";
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || "endurance-demo-2026";
const HISTORY_DAYS = 400;

type Row = { symbol: string; name?: string; assetClass: AssetClass; sector: string; qty: number; avg: number; ltp: number; dayPct: number; vol: number };

const PORTFOLIO: Row[] = [
  { symbol: "HDFCBANK", assetClass: "STOCK", sector: "Financial Services", qty: 170, avg: 1480, ltp: 1712, dayPct: 0.8, vol: 0.2 },
  { symbol: "ICICIBANK", assetClass: "STOCK", sector: "Financial Services", qty: 120, avg: 980, ltp: 1265, dayPct: -0.4, vol: 0.22 },
  { symbol: "BAJFINANCE", assetClass: "STOCK", sector: "Financial Services", qty: 22, avg: 7200, ltp: 6850, dayPct: -1.6, vol: 0.3 },
  { symbol: "KOTAKBANK", assetClass: "STOCK", sector: "Financial Services", qty: 40, avg: 1850, ltp: 1790, dayPct: 0.3, vol: 0.22 },
  { symbol: "INFY", assetClass: "STOCK", sector: "Information Technology", qty: 90, avg: 1420, ltp: 1580, dayPct: 1.2, vol: 0.24 },
  { symbol: "TCS", assetClass: "STOCK", sector: "Information Technology", qty: 25, avg: 3600, ltp: 3410, dayPct: -0.9, vol: 0.2 },
  { symbol: "HCLTECH", assetClass: "STOCK", sector: "Information Technology", qty: 40, avg: 1150, ltp: 1620, dayPct: 0.6, vol: 0.24 },
  { symbol: "RELIANCE", assetClass: "STOCK", sector: "Oil Gas & Consumable Fuels", qty: 160, avg: 1210, ltp: 1420, dayPct: 0.2, vol: 0.22 },
  { symbol: "ITC", assetClass: "STOCK", sector: "Fast Moving Consumer Goods", qty: 300, avg: 330, ltp: 418, dayPct: -0.3, vol: 0.18 },
  { symbol: "HINDUNILVR", assetClass: "STOCK", sector: "Fast Moving Consumer Goods", qty: 30, avg: 2550, ltp: 2380, dayPct: -0.7, vol: 0.18 },
  { symbol: "TATAMOTORS", assetClass: "STOCK", sector: "Automobile and Auto Components", qty: 120, avg: 640, ltp: 712, dayPct: 2.1, vol: 0.34 },
  { symbol: "MARUTI", assetClass: "STOCK", sector: "Automobile and Auto Components", qty: 6, avg: 9800, ltp: 12600, dayPct: 0.9, vol: 0.24 },
  { symbol: "SUNPHARMA", assetClass: "STOCK", sector: "Healthcare", qty: 60, avg: 1050, ltp: 1720, dayPct: 0.4, vol: 0.22 },
  { symbol: "LT", assetClass: "STOCK", sector: "Construction", qty: 30, avg: 2900, ltp: 3640, dayPct: -0.5, vol: 0.24 },
  { symbol: "TATASTEEL", assetClass: "STOCK", sector: "Metals & Mining", qty: 400, avg: 118, ltp: 152, dayPct: 1.8, vol: 0.32 },
  { symbol: "NTPC", assetClass: "STOCK", sector: "Power", qty: 250, avg: 260, ltp: 345, dayPct: -1.1, vol: 0.26 },
  { symbol: "BHARTIARTL", assetClass: "STOCK", sector: "Telecommunication", qty: 50, avg: 980, ltp: 1890, dayPct: 0.7, vol: 0.22 },
  { symbol: "TITAN", assetClass: "STOCK", sector: "Consumer Durables", qty: 15, avg: 3100, ltp: 3380, dayPct: -2.4, vol: 0.26 },
  { symbol: "PIDILITIND", assetClass: "STOCK", sector: "Chemicals", qty: 12, avg: 2700, ltp: 2980, dayPct: 0.1, vol: 0.22 },
  { symbol: "ETERNAL", assetClass: "STOCK", sector: "Consumer Services", qty: 400, avg: 95, ltp: 248, dayPct: 3.2, vol: 0.42 },
  { symbol: "KRN", assetClass: "STOCK", sector: "Unclassified", qty: 100, avg: 470, ltp: 820, dayPct: -3.4, vol: 0.5 },
  { symbol: "NIFTYBEES", assetClass: "ETF", sector: "Index funds & ETFs", qty: 600, avg: 210, ltp: 268, dayPct: 0.4, vol: 0.16 },
  { symbol: "GOLDBEES", assetClass: "GOLD", sector: "Gold", qty: 900, avg: 48, ltp: 66, dayPct: -0.2, vol: 0.14 },
  { symbol: "SGBAUG28", assetClass: "GOLD", sector: "Gold", qty: 10, avg: 5300, ltp: 7600, dayPct: -0.2, vol: 0.14 },
  { symbol: "INF879O01027", name: "Parag Parikh Flexi Cap Fund - Direct Plan - Growth", assetClass: "MUTUAL_FUND", sector: "Equity: flexi & multi cap", qty: 1800, avg: 62, ltp: 84, dayPct: 0.5, vol: 0.15 },
  { symbol: "INF846K01CH7", name: "Axis Small Cap Fund - Direct Plan - Growth", assetClass: "MUTUAL_FUND", sector: "Equity: small cap", qty: 900, avg: 78, ltp: 101, dayPct: 1.1, vol: 0.24 },
  { symbol: "INF179K01VC4", name: "HDFC Corporate Bond Fund - Direct Plan - Growth", assetClass: "MUTUAL_FUND", sector: "Debt", qty: 4000, avg: 28, ltp: 31, dayPct: 0.02, vol: 0.03 },
  { symbol: "INF789F01XA0", name: "UTI Nifty 50 Index Fund - Direct Plan - Growth", assetClass: "MUTUAL_FUND", sector: "Index funds", qty: 1500, avg: 140, ltp: 162, dayPct: 0.4, vol: 0.16 },
  { symbol: "INF109K01VQ1", name: "ICICI Prudential Liquid Fund - Direct Plan - Growth", assetClass: "MUTUAL_FUND", sector: "Debt: liquid", qty: 120, avg: 350, ltp: 362, dayPct: 0.02, vol: 0.005 },
];

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(random: () => number) {
  const u = Math.max(random(), 1e-12);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * random());
}

/** Weekday dates from HISTORY_DAYS ago to today, at 3:30 PM IST (market close). */
function tradingDays() {
  const days: Date[] = [];
  const today = new Date();
  for (let offset = HISTORY_DAYS; offset >= 0; offset -= 1) {
    const day = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - offset, 10, 0));
    const weekday = day.getUTCDay();
    if (weekday !== 0 && weekday !== 6) days.push(day);
  }
  return days;
}

/** Brownian bridge in log price from the average buy price to today's price. */
function pricePath(row: Row, steps: number, random: () => number) {
  const start = Math.log(row.avg);
  const end = Math.log(row.ltp);
  const sigma = row.vol / Math.sqrt(252);
  const walk = [0];
  for (let i = 1; i < steps; i += 1) walk.push(walk[i - 1] + sigma * gaussian(random));
  const last = walk[steps - 1];
  return walk.map((w, i) => Math.exp(start + ((end - start) * i) / (steps - 1) + w - (last * i) / (steps - 1)));
}

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("seed-demo is for development databases only.");

  const db = getDb();
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const user = await db.user.upsert({
    where: { email: DEMO_EMAIL },
    update: { passwordHash },
    create: { email: DEMO_EMAIL, name: "Aarav Mehta", passwordHash, role: (await db.user.count()) === 0 ? "OWNER" : "MEMBER" },
  });
  const scoped = tenantDb(user.id);

  await scoped.userSettings.upsert({ where: { userId: user.id }, update: {}, create: { userId: user.id } });
  await scoped.investmentSnapshot.deleteMany({});
  await scoped.holding.deleteMany({});

  await saveCredential(scoped, user.id, "KITE_APP", { apiKey: "demoapikey0000", apiSecret: "demo-secret-not-real-000000" });
  await storeKiteSession(scoped, user.id, { accessToken: "demo-token", kiteUserId: "DM4821", displayName: "Aarav Mehta" });

  const account = await scoped.investmentAccount.upsert({
    where: { userId_provider_accountRef: { userId: user.id, provider: "KITE", accountRef: "DM4821" } },
    update: {},
    create: { userId: user.id, provider: "KITE", accountRef: "DM4821", accountName: "Zerodha DM4821" },
  });

  const days = tradingDays();
  const random = mulberry32(20261021);
  const now = new Date();

  for (const row of PORTFOLIO) {
    const path = pricePath(row, days.length, random);
    const value = row.qty * row.ltp;
    const invested = row.qty * row.avg;
    const holding = await scoped.holding.create({
      data: {
        userId: user.id,
        accountId: account.id,
        source: "KITE",
        assetClass: row.assetClass,
        instrumentKey: row.assetClass === "MUTUAL_FUND" ? row.symbol : `NSE:${row.symbol}`,
        symbol: row.symbol,
        isin: row.assetClass === "MUTUAL_FUND" ? row.symbol : null,
        name: row.name ?? row.symbol,
        exchange: row.assetClass === "MUTUAL_FUND" ? null : "NSE",
        sector: row.sector,
        quantity: row.qty,
        averagePrice: row.avg,
        lastPrice: row.ltp,
        closePrice: row.ltp / (1 + row.dayPct / 100),
        currentValue: value,
        pnl: value - invested,
        pnlPct: ((value - invested) / invested) * 100,
        dayChange: value - value / (1 + row.dayPct / 100),
        asOf: now,
      },
    });
    await scoped.investmentSnapshot.createMany({
      data: days.map((day, i) => ({
        userId: user.id,
        holdingId: holding.id,
        source: "KITE",
        capturedAt: i === days.length - 1 ? now : day,
        quantity: row.qty,
        price: Math.round(path[i] * 100) / 100,
        value: Math.round(row.qty * path[i] * 100) / 100,
        pnl: Math.round((row.qty * path[i] - invested) * 100) / 100,
      })),
    });
  }

  console.log(`Seeded ${PORTFOLIO.length} holdings with ${days.length} days of history for ${DEMO_EMAIL}.`);
  await db.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
