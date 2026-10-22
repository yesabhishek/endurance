import { UNCLASSIFIED, shortName, type PortfolioAnalysis } from "./portfolio";

export type Zone = "good" | "watch" | "high";

export type RiskCheck = {
  id: "single-stock" | "sector" | "top5" | "breadth" | "in-loss";
  label: string;
  value: number;
  unit: "%" | "holdings";
  zone: Zone;
  /** Where the watch and high zones begin, in the same unit as value. */
  watchAt: number;
  highAt: number;
  /** Right end of the meter track. */
  max: number;
  /** False when a lower value is the risky side (breadth). */
  higherIsWorse: boolean;
  detail: string;
  question: string;
};

export type RiskReport = {
  checks: RiskCheck[];
  level: "Low" | "Moderate" | "Elevated" | "High";
  highCount: number;
  watchCount: number;
};

type Input = Pick<PortfolioAnalysis, "holdings" | "sectors" | "concentration" | "limits" | "total">;

const fmt = (value: number) => `${value.toFixed(1)}%`;

function zoneFor(value: number, watchAt: number, highAt: number, higherIsWorse = true): Zone {
  if (higherIsWorse) return value > highAt ? "high" : value > watchAt ? "watch" : "good";
  return value < highAt ? "high" : value < watchAt ? "watch" : "good";
}

/**
 * Five plain checks on concentration and drawdown. The single-stock and sector
 * zones come from the user's own limits; the rest use common rules of thumb.
 */
export function assessRisk(portfolio: Input): RiskReport {
  const { holdings, sectors, concentration, limits, total } = portfolio;
  const checks: RiskCheck[] = [];

  const stocks = holdings.filter((h) => h.assetClass === "STOCK");
  const topStock = stocks[0];
  const stockLimit = limits.singleStockLimitPct;
  const stockWeight = topStock?.weightPct ?? 0;
  checks.push({
    id: "single-stock",
    label: "Largest single stock",
    value: stockWeight,
    unit: "%",
    zone: zoneFor(stockWeight, stockLimit * 0.8, stockLimit),
    watchAt: stockLimit * 0.8,
    highAt: stockLimit,
    max: Math.max(stockLimit * 2, stockWeight * 1.15),
    higherIsWorse: true,
    detail: topStock ? `${topStock.symbol} is ${fmt(stockWeight)} of your portfolio. Your limit is ${fmt(stockLimit)}.` : "No direct stock holdings.",
    question: topStock ? `How risky is my ${fmt(stockWeight)} position in ${topStock.symbol}, and what would a 20% fall in it do to my portfolio?` : "Do I have any single-stock concentration risk?",
  });

  const sector = sectors.find((slice) => slice.label !== UNCLASSIFIED);
  const sectorLimit = limits.sectorLimitPct;
  const sectorPct = sector?.pct ?? 0;
  checks.push({
    id: "sector",
    label: "Largest sector",
    value: sectorPct,
    unit: "%",
    zone: zoneFor(sectorPct, sectorLimit * 0.8, sectorLimit),
    watchAt: sectorLimit * 0.8,
    highAt: sectorLimit,
    max: Math.min(100, Math.max(sectorLimit * 2, sectorPct * 1.15)),
    higherIsWorse: true,
    detail: sector ? `${sector.label} is ${fmt(sectorPct)} of your stocks across ${sector.count} holding${sector.count === 1 ? "" : "s"}. Your limit is ${fmt(sectorLimit)}.` : "No classified stock sectors yet.",
    question: sector ? `Break down my ${sector.label} exposure. Which holdings make it up and how far over my ${fmt(sectorLimit)} limit am I?` : "How is my equity spread across sectors?",
  });

  const top5 = concentration.top5Pct;
  checks.push({
    id: "top5",
    label: "Top 5 holdings",
    value: top5,
    unit: "%",
    zone: zoneFor(top5, 40, 60),
    watchAt: 40,
    highAt: 60,
    max: 100,
    higherIsWorse: true,
    detail: `${holdings
      .slice(0, 5)
      .map((h) => shortName(h))
      .join(", ")} together hold ${fmt(top5)} of your money.`,
    question: "My top 5 holdings: how much of my portfolio do they carry, and how would it look if each were capped at my single-stock limit?",
  });

  const breadth = concentration.effectivePositions;
  checks.push({
    id: "breadth",
    label: "Effective number of holdings",
    value: breadth,
    unit: "holdings",
    zone: zoneFor(breadth, 15, 8, false),
    watchAt: 15,
    highAt: 8,
    max: Math.max(30, breadth * 1.15),
    higherIsWorse: false,
    detail: `Your ${holdings.length} holdings behave like ${breadth.toFixed(1)} equally sized ones, because a few large positions dominate.`,
    question: `I hold ${holdings.length} positions but they behave like ${breadth.toFixed(1)} equal ones. Explain what that means and which positions cause it.`,
  });

  const losing = holdings.filter((h) => h.pnl < 0);
  const inLoss = total > 0 ? (losing.reduce((sum, h) => sum + h.value, 0) / total) * 100 : 0;
  checks.push({
    id: "in-loss",
    label: "Money in losing positions",
    value: inLoss,
    unit: "%",
    zone: zoneFor(inLoss, 15, 30),
    watchAt: 15,
    highAt: 30,
    max: 100,
    higherIsWorse: true,
    detail: losing.length
      ? `${losing.length} holding${losing.length === 1 ? " is" : "s are"} below cost, worth ${fmt(inLoss)} of your portfolio.`
      : "Every holding is above its average buy price.",
    question: "Which of my holdings are below cost, and by how much in rupees and percent?",
  });

  const highCount = checks.filter((check) => check.zone === "high").length;
  const watchCount = checks.filter((check) => check.zone === "watch").length;
  const level = highCount >= 2 ? "High" : highCount === 1 ? "Elevated" : watchCount >= 2 ? "Moderate" : "Low";
  return { checks, level, highCount, watchCount };
}
