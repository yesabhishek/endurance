import path from "node:path";

// Everything Endurance needs comes from environment variables, which Next.js
// loads from `.env` in the project folder. See `.env.example`.

const PLACEHOLDER = /^(your[-_ ].*|change[-_ ]?me|replace[-_ ].*|x{3,}|<.*>)$/i;

/** A trimmed env value, or undefined when it is empty or still the example placeholder. */
export function env(name: string) {
  const value = process.env[name]?.trim();
  return value && !PLACEHOLDER.test(value) ? value : undefined;
}

export function isDemo() {
  return env("ENDURANCE_DEMO") === "true";
}

/** Where the browser reaches the app. Kite's redirect URL is this plus /api/kite/callback. */
export function appUrl() {
  return new URL(env("APP_URL") ?? "http://localhost:3000");
}

export function kiteRedirectUrl() {
  return new URL("/api/kite/callback", appUrl()).toString();
}

/** Local folder for the Kite session, portfolio snapshots and chats. Demo mode keeps its own inside it. */
export function dataDir() {
  const base = env("DATA_DIR") ?? ".data";
  // Resolved at runtime only; without the hint the bundler would copy the whole project into the build.
  const root = path.resolve(/*turbopackIgnore: true*/ process.cwd(), base);
  return isDemo() ? path.join(root, "demo") : root;
}

export function kiteKeys() {
  const apiKey = env("KITE_API_KEY");
  const apiSecret = env("KITE_API_SECRET");
  return apiKey && apiSecret ? { apiKey, apiSecret } : null;
}

export type Limits = { singleStockLimitPct: number; sectorLimitPct: number };

function percent(name: string, fallback: number) {
  const value = Number(env(name));
  return Number.isFinite(value) && value > 0 && value <= 100 ? value : fallback;
}

/** Your own concentration limits, used by the risk checks and the assistant. */
export function limits(): Limits {
  return {
    singleStockLimitPct: percent("LIMIT_STOCK_PCT", 10),
    sectorLimitPct: percent("LIMIT_SECTOR_PCT", 25),
  };
}
