import type { PortfolioAnalysis } from "./portfolio";

/** Starter questions grounded in what this portfolio actually holds. */
export function portfolioSuggestions(portfolio: Pick<PortfolioAnalysis, "holdings" | "breaches" | "sectors" | "dayChange">): string[] {
  if (!portfolio.holdings.length) {
    return ["What can you tell me once my Kite holdings sync?", "How do sector limits work in Endurance?"];
  }
  const out: string[] = [];
  const heavy = portfolio.breaches.overweightHoldings[0];
  if (heavy) out.push(`What happens to my portfolio if ${heavy.symbol} falls 20%?`);
  const sector = portfolio.breaches.overweightSectors[0] ?? portfolio.sectors[0];
  if (sector) out.push(`How exposed am I to ${sector.label}, and through which holdings?`);
  out.push(portfolio.dayChange >= 0 ? "What drove today's gain?" : "What dragged my portfolio down today?");
  out.push("What could my portfolio be worth in 20 years with a ₹25,000 monthly SIP?");
  const loser = [...portfolio.holdings].filter((h) => h.pnl < 0).sort((a, b) => a.pnl - b.pnl)[0];
  if (loser && out.length < 5) out.push(`How much has ${loser.assetClass === "MUTUAL_FUND" ? loser.name.split(" - ")[0] : loser.symbol} lost since I bought it?`);
  return out.slice(0, 5);
}
