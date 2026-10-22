import { describe, expect, it } from "vitest";
import { classifyEquity, classifyFund } from "@/lib/securities";
import { KiteError, kiteLoginUrl, nextKiteExpiry } from "./client";
import { normalizeEquity, normalizeFund } from "./sync";

describe("Kite login", () => {
  it("puts the CSRF state in redirect_params", () => {
    const url = new URL(kiteLoginUrl("abc123key", "state-xyz"));
    expect(url.origin + url.pathname).toBe("https://kite.zerodha.com/connect/login");
    expect(url.searchParams.get("api_key")).toBe("abc123key");
    expect(url.searchParams.get("v")).toBe("3");
    expect(new URLSearchParams(url.searchParams.get("redirect_params") ?? "").get("state")).toBe("state-xyz");
  });

  it("expires sessions at the next 06:00 IST", () => {
    // 20 Oct 2026, 22:00 IST = 16:30 UTC -> expires 21 Oct 06:00 IST = 00:30 UTC
    expect(nextKiteExpiry(new Date("2026-10-20T16:30:00Z")).toISOString()).toBe("2026-10-21T00:30:00.000Z");
    // 21 Oct 2026, 05:00 IST = 23:30 UTC on the 20th -> same morning 06:00 IST
    expect(nextKiteExpiry(new Date("2026-10-20T23:30:00Z")).toISOString()).toBe("2026-10-21T00:30:00.000Z");
  });

  it("recognises an expired token", () => {
    expect(new KiteError("Incorrect `api_key` or `access_token`.", "TokenException", 403).isTokenExpired).toBe(true);
    expect(new KiteError("Too many requests", "NetworkException", 429).isTokenExpired).toBe(false);
  });
});

describe("holding normalisation", () => {
  it("counts T+1 shares and computes today's change for the whole position", () => {
    const holding = normalizeEquity(
      { tradingsymbol: "INFY", exchange: "NSE", isin: "INE009A01021", quantity: 90, t1_quantity: 5, average_price: 1402.1, last_price: 1698.3, close_price: 1690, pnl: null, day_change: 8.3 },
      "Information Technology",
    );
    expect(holding.quantity).toBe(95);
    expect(holding.value).toBe(161338.5);
    expect(holding.pnl).toBe(28139);
    expect(holding.dayChange).toBe(788.5);
    expect(holding.sector).toBe("Information Technology");
    expect(holding.key).toBe("NSE:INFY");
  });

  it("keys mutual funds by ISIN and folio and buckets them by category", () => {
    const fund = normalizeFund({ tradingsymbol: "INF179K01VQ7", fund: "HDFC Flexi Cap Fund - Direct Plan", folio: "1234/56", quantity: 100.5, average_price: 1500, last_price: 1800, pnl: null });
    expect(fund.key).toBe("INF179K01VQ7:1234/56");
    expect(fund.sector).toBe("Equity: flexi & multi cap");
    expect(fund.value).toBe(180900);
  });

  it("does not mistake a company for a fund because of its symbol", () => {
    expect(classifyEquity("GOLDIAM", "INE025B01025", "Consumer Durables")).toEqual({ assetClass: "STOCK", sector: "Consumer Durables" });
    expect(classifyEquity("GOLDBEES", "INF204KB17I5", undefined)).toEqual({ assetClass: "GOLD", sector: "Gold" });
    expect(classifyEquity("NIFTYBEES", "INF204KB14I2", undefined).assetClass).toBe("ETF");
    expect(classifyEquity("NEWSME", "INE000X01010", undefined)).toEqual({ assetClass: "STOCK", sector: "Unclassified" });
  });

  it("buckets fund names sensibly", () => {
    expect(classifyFund("Parag Parikh Liquid Fund")).toBe("Debt: liquid");
    expect(classifyFund("UTI Nifty 50 Index Fund")).toBe("Index funds");
    expect(classifyFund("Axis Small Cap Fund")).toBe("Equity: small cap");
  });
});
