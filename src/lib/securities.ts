import { UNCLASSIFIED, type AssetClass } from "./portfolio";
import { readJson, writeJson } from "./store";

// Sector reference data. NSE publishes index constituent lists with each company's
// industry under its macro-economic sector scheme. The Nifty Total Market list covers
// about 750 companies, which includes nearly every stock a retail investor holds.
// Data is fetched by your own install, for your own use.

const SOURCES = [
  { name: "nifty-total-market", url: "https://niftyindices.com/IndexConstituent/ind_niftytotalmarket_list.csv" },
  { name: "nifty-500", url: "https://archives.nseindia.com/content/indices/ind_nifty500list.csv" },
];

const REFRESH_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

type SecurityRow = { isin: string; symbol: string; name: string; sector: string };

/** Minimal RFC 4180 CSV parser (quoted fields, escaped quotes, CRLF). */
export function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      row.push(field);
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  row.push(field);
  if (row.some((cell) => cell.trim())) rows.push(row);
  return rows;
}

export function parseConstituents(csv: string): SecurityRow[] {
  const [header, ...rows] = parseCsv(csv.replace(/^﻿/, ""));
  if (!header) return [];
  const index = (name: string) => header.findIndex((cell) => cell.trim().toLowerCase() === name);
  const isinAt = index("isin code");
  const industryAt = index("industry");
  const symbolAt = index("symbol");
  const nameAt = index("company name");
  if (isinAt < 0 || industryAt < 0) return [];

  return rows
    .map((row) => ({
      isin: row[isinAt]?.trim().toUpperCase() ?? "",
      sector: row[industryAt]?.trim() ?? "",
      symbol: row[symbolAt]?.trim() ?? "",
      name: row[nameAt]?.trim() ?? "",
    }))
    .filter((row) => /^IN[A-Z0-9]{10}$/.test(row.isin) && row.sector);
}

async function download(url: string) {
  const response = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; Endurance portfolio app)", Accept: "text/csv,*/*" },
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

type SectorFile = { fetchedAt: string; source: string; sectors: Record<string, string> };

let inflight: Promise<Map<string, string>> | null = null;

/**
 * ISIN to NSE sector, cached in .data/sectors.json and refreshed weekly.
 * Never throws: if NSE is unreachable you keep the last list (or none, and
 * stocks show as Unclassified until the next try).
 */
export function sectorMap(): Promise<Map<string, string>> {
  inflight ??= loadSectors().finally(() => {
    inflight = null;
  });
  return inflight;
}

async function loadSectors() {
  const cached = await readJson<SectorFile>("sectors.json").catch(() => null);
  const fresh = cached && Date.now() - Date.parse(cached.fetchedAt) < REFRESH_AFTER_MS;
  if (cached && fresh) return new Map(Object.entries(cached.sectors));

  for (const source of SOURCES) {
    try {
      const rows = parseConstituents(await download(source.url));
      if (rows.length < 100) continue;
      const file: SectorFile = { fetchedAt: new Date().toISOString(), source: source.name, sectors: Object.fromEntries(rows.map((row) => [row.isin, row.sector])) };
      await writeJson("sectors.json", file);
      return new Map(Object.entries(file.sectors));
    } catch (error) {
      console.warn(`[securities] ${source.name} unavailable:`, error instanceof Error ? error.message : error);
    }
  }
  return new Map(Object.entries(cached?.sectors ?? {}));
}

/** Exchange-traded funds and gold don't belong to a company sector; classify them by what they hold. */
export function classifyEquity(symbol: string, isin: string | undefined, knownSector: string | undefined): { assetClass: AssetClass; sector: string } {
  // A company in NSE's list is a stock, even if its symbol looks like a fund (GOLDIAM, say).
  if (knownSector) return { assetClass: "STOCK", sector: knownSector };

  const upper = symbol.toUpperCase();
  const isFundUnit = Boolean(isin?.startsWith("INF")); // ETFs carry mutual-fund ISINs
  if (/^SGB/.test(upper) || (isFundUnit && /GOLD/.test(upper))) return { assetClass: "GOLD", sector: "Gold" };
  if (isFundUnit && /SILVER/.test(upper)) return { assetClass: "ETF", sector: "Silver" };
  if (isFundUnit && /LIQUID/.test(upper)) return { assetClass: "ETF", sector: "Liquid / cash" };
  if (isFundUnit || /BEES$|ETF$/.test(upper)) return { assetClass: "ETF", sector: "Index funds & ETFs" };
  return { assetClass: "STOCK", sector: UNCLASSIFIED };
}

/** Rough mutual fund bucket from the scheme name; fund look-through would need AMC portfolio files. */
export function classifyFund(name: string) {
  const n = name.toLowerCase();
  if (/liquid|overnight|money market/.test(n)) return "Debt: liquid";
  if (/gilt|bond|debt|duration|corporate|banking & psu|credit|income|treasury|floater/.test(n)) return "Debt";
  if (/gold|silver/.test(n)) return "Gold & silver funds";
  if (/index|nifty|sensex|etf/.test(n)) return "Index funds";
  if (/hybrid|balanced|arbitrage|multi asset|equity savings|dynamic asset/.test(n)) return "Hybrid";
  if (/international|global|us |nasdaq|s&p|overseas|fof/.test(n)) return "International";
  if (/elss|tax saver/.test(n)) return "Equity: ELSS";
  if (/small cap|smallcap/.test(n)) return "Equity: small cap";
  if (/mid cap|midcap/.test(n)) return "Equity: mid cap";
  if (/large cap|largecap|bluechip|top 100/.test(n)) return "Equity: large cap";
  if (/flexi|multi cap|multicap|focused|value|contra|equity/.test(n)) return "Equity: flexi & multi cap";
  return "Mutual funds (other)";
}
