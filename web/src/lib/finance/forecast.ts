import type { AssetClass } from "@prisma/client";

// A 20-year projection is only as good as its assumptions, so the model is kept
// deliberately simple and fully visible: the portfolio is split into four
// buckets, each with an expected return and volatility, blended with fixed
// correlations and simulated month by month. The AI forecast changes the
// assumptions, never the math.

export const BUCKETS = ["equity", "debt", "gold", "cash"] as const;
export type Bucket = (typeof BUCKETS)[number];

export const BUCKET_LABELS: Record<Bucket, string> = {
  equity: "Equity",
  debt: "Debt",
  gold: "Gold & silver",
  cash: "Cash & liquid",
};

export type BucketAssumption = { expectedReturnPct: number; volatilityPct: number; note: string };
export type Assumptions = { buckets: Record<Bucket, BucketAssumption>; inflationPct: number };

/** Long-run nominal rupee assumptions used when the AI forecast is off. */
export const BASELINE: Assumptions = {
  buckets: {
    equity: { expectedReturnPct: 12, volatilityPct: 18, note: "Broad Indian equity, close to the Nifty 50's long-run record." },
    debt: { expectedReturnPct: 7, volatilityPct: 3, note: "High-quality bond funds, near today's yields." },
    gold: { expectedReturnPct: 9, volatilityPct: 15, note: "Gold in rupees, which includes the rupee's long-run slide." },
    cash: { expectedReturnPct: 6, volatilityPct: 1, note: "Liquid funds and overnight rates." },
  },
  inflationPct: 5,
};

// Rough long-run correlations between buckets (equity, debt, gold, cash).
const CORRELATION: Record<Bucket, Record<Bucket, number>> = {
  equity: { equity: 1, debt: 0.1, gold: 0, cash: 0 },
  debt: { equity: 0.1, debt: 1, gold: 0.1, cash: 0.3 },
  gold: { equity: 0, debt: 0.1, gold: 1, cash: 0 },
  cash: { equity: 0, debt: 0.3, gold: 0, cash: 1 },
};

type BucketMix = Partial<Record<Bucket, number>>;

/** Which bucket a holding belongs to, from its asset class and category. Hybrids split. */
export function bucketMix(holding: { assetClass: AssetClass; sector: string }): BucketMix {
  const sector = holding.sector.toLowerCase();
  switch (holding.assetClass) {
    case "GOLD":
      return { gold: 1 };
    case "CASH":
      return { cash: 1 };
    case "ETF":
      if (/liquid|cash/.test(sector)) return { cash: 1 };
      if (/gold|silver/.test(sector)) return { gold: 1 };
      return { equity: 1 };
    case "MUTUAL_FUND":
      if (sector.startsWith("debt: liquid")) return { cash: 1 };
      if (sector.startsWith("debt")) return { debt: 1 };
      if (/gold|silver/.test(sector)) return { gold: 1 };
      if (sector.startsWith("hybrid")) return { equity: 0.6, debt: 0.4 };
      return { equity: 1 };
    default:
      return { equity: 1 };
  }
}

/** Share of the portfolio in each bucket, as fractions that add up to 1. */
export function bucketWeights(holdings: Array<{ assetClass: AssetClass; sector: string; value: number }>): Record<Bucket, number> {
  const totals: Record<Bucket, number> = { equity: 0, debt: 0, gold: 0, cash: 0 };
  let sum = 0;
  for (const holding of holdings) {
    if (holding.value <= 0) continue;
    for (const [bucket, share] of Object.entries(bucketMix(holding)) as Array<[Bucket, number]>) {
      totals[bucket] += holding.value * share;
    }
    sum += holding.value;
  }
  if (sum <= 0) return totals;
  for (const bucket of BUCKETS) totals[bucket] /= sum;
  return totals;
}

/** Expected annual return and volatility (both in percent) of the blended mix. */
export function blend(weights: Record<Bucket, number>, assumptions: Assumptions) {
  let mu = 0;
  let variance = 0;
  for (const a of BUCKETS) {
    const ai = assumptions.buckets[a];
    mu += weights[a] * ai.expectedReturnPct;
    for (const b of BUCKETS) {
      const bi = assumptions.buckets[b];
      variance += weights[a] * weights[b] * (ai.volatilityPct / 100) * (bi.volatilityPct / 100) * CORRELATION[a][b];
    }
  }
  return { expectedReturnPct: mu, volatilityPct: Math.sqrt(Math.max(variance, 0)) * 100 };
}

export type ProjectionInput = {
  startValue: number;
  monthlySip: number;
  /** Yearly increase in the SIP amount, in percent. */
  stepUpPct: number;
  years: number;
  expectedReturnPct: number;
  volatilityPct: number;
  inflationPct: number;
  /** Show values in today's rupees. */
  real: boolean;
  paths?: number;
  seed?: number;
};

export type ProjectionPoint = { year: number; p10: number; p25: number; p50: number; p75: number; p90: number; contributed: number };

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function quantile(sorted: Float64Array, q: number) {
  const position = (sorted.length - 1) * q;
  const low = Math.floor(position);
  const high = Math.ceil(position);
  return sorted[low] + (sorted[high] - sorted[low]) * (position - low);
}

/**
 * Monte Carlo of monthly log-normal returns with monthly SIPs. Seeded, so the
 * same inputs always draw the same fan. Returns one point per year from 0.
 */
export function project(input: ProjectionInput): ProjectionPoint[] {
  const paths = input.paths ?? 1000;
  const months = Math.round(input.years * 12);
  const sigma = Math.max(input.volatilityPct, 0) / 100;
  const drift = (Math.log(1 + input.expectedReturnPct / 100) - (sigma * sigma) / 2) / 12;
  const monthlyVol = sigma / Math.sqrt(12);
  const random = mulberry32(input.seed ?? 20260101);

  const yearly: Float64Array[] = Array.from({ length: input.years + 1 }, () => new Float64Array(paths));
  const contributed: number[] = [input.startValue];

  for (let p = 0; p < paths; p += 1) {
    let value = input.startValue;
    let sip = input.monthlySip;
    let paid = input.startValue;
    yearly[0][p] = value;
    for (let m = 1; m <= months; m += 1) {
      // Box-Muller; one normal draw per month.
      const u = Math.max(random(), 1e-12);
      const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * random());
      value = value * Math.exp(drift + monthlyVol * z) + sip;
      paid += sip;
      if (m % 12 === 0) {
        const year = m / 12;
        const deflator = input.real ? (1 + input.inflationPct / 100) ** year : 1;
        yearly[year][p] = value / deflator;
        if (p === 0) contributed[year] = paid / deflator;
        sip *= 1 + input.stepUpPct / 100;
      }
    }
  }

  return yearly.map((values, year) => {
    const sorted = values.slice().sort();
    return {
      year,
      p10: quantile(sorted, 0.1),
      p25: quantile(sorted, 0.25),
      p50: quantile(sorted, 0.5),
      p75: quantile(sorted, 0.75),
      p90: quantile(sorted, 0.9),
      contributed: contributed[year] ?? 0,
    };
  });
}

/** Clamps AI-suggested numbers to a sane range so one bad answer can't draw an absurd chart. */
export function clampAssumption(value: number, min: number, max: number, fallback: number) {
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}
