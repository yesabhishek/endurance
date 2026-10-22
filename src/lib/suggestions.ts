import type { Suggestion } from "@/components/chat/chat";
import { UNCLASSIFIED, shortName, type PortfolioAnalysis } from "./portfolio";

/** Starter questions built from what this portfolio actually holds. */
export function suggestionsFor(portfolio: PortfolioAnalysis | null, historyDays: number): Suggestion[] {
  if (!portfolio || !portfolio.holdings.length) return [];
  const out: Suggestion[] = [];

  out.push({
    title: "Today's brief",
    icon: "brief",
    prompt: portfolio.dayChange >= 0 ? "What moved my portfolio today, and which holdings drove the gain?" : "What pulled my portfolio down today, and which holdings drove it?",
  });

  const overStock = portfolio.breaches.overweightHoldings[0];
  const overSector = portfolio.breaches.overweightSectors[0];
  out.push({
    title: "Concentration check",
    icon: "concentration",
    prompt: overStock || overSector ? "Where am I over my own concentration limits, and by how much?" : "How concentrated is my portfolio across holdings and sectors?",
  });

  const largestStock = portfolio.holdings.find((h) => h.assetClass === "STOCK");
  if (largestStock) {
    out.push({ title: "Stress test", icon: "stress", prompt: `What happens to my portfolio if ${largestStock.symbol} falls 20%?` });
  } else {
    out.push({ title: "Stress test", icon: "stress", prompt: "What happens to my portfolio if everything falls 10%?" });
  }

  const losers = portfolio.holdings.filter((h) => h.pnl < 0);
  if (losers.length) out.push({ title: "Below cost", icon: "loss", prompt: "Which holdings are below my buy price, and by how much?" });

  const sector = overSector ?? portfolio.sectors.find((slice) => slice.label !== UNCLASSIFIED);
  if (sector) out.push({ title: "Sector exposure", icon: "sector", prompt: `How exposed am I to ${sector.label}, and through which holdings?` });

  if (historyDays >= 2) {
    out.push({ title: "Performance", icon: "history", prompt: "How has my portfolio value changed over the last 3 months, excluding money I added?" });
  } else {
    const fund = portfolio.holdings.find((h) => h.assetClass === "MUTUAL_FUND");
    out.push({ title: "Asset mix", icon: "history", prompt: fund ? `How is my money split across stocks, funds and gold? Where does ${shortName(fund)} fit?` : "How is my money split across stocks, funds, ETFs and gold?" });
  }

  return out.slice(0, 6);
}
