import { describe, expect, it } from "vitest";
import { buildCsp, isAllowedHost, isPublicPath, isSameOriginWrite } from "./request-guard";

const config = { appUrl: "http://localhost:3000", allowedHosts: "portfolio.example.in" };

describe("host allowlist", () => {
  it("accepts loopback names and configured hosts", () => {
    expect(isAllowedHost("localhost:3000", config)).toBe(true);
    expect(isAllowedHost("127.0.0.1:3000", config)).toBe(true);
    expect(isAllowedHost("[::1]:3000", config)).toBe(true);
    expect(isAllowedHost("portfolio.example.in", config)).toBe(true);
  });

  it("rejects DNS-rebinding hosts and missing headers", () => {
    expect(isAllowedHost("evil.example.com", config)).toBe(false);
    expect(isAllowedHost("localhost.evil.com", config)).toBe(false);
    expect(isAllowedHost(null, config)).toBe(false);
  });
});

describe("cross-site write protection", () => {
  const headers = (entries: Record<string, string>) => new Headers({ host: "localhost:3000", ...entries });

  it("allows reads and same-origin writes", () => {
    expect(isSameOriginWrite("GET", headers({ origin: "https://evil.example.com" }))).toBe(true);
    expect(isSameOriginWrite("POST", headers({ origin: "http://localhost:3000" }))).toBe(true);
    expect(isSameOriginWrite("POST", headers({ "sec-fetch-site": "same-origin" }))).toBe(true);
  });

  it("blocks writes from other sites, including the old wipe-everything form trick", () => {
    expect(isSameOriginWrite("POST", headers({ origin: "https://evil.example.com" }))).toBe(false);
    expect(isSameOriginWrite("DELETE", headers({ origin: "null" }))).toBe(false);
    expect(isSameOriginWrite("POST", headers({ "sec-fetch-site": "cross-site" }))).toBe(false);
  });
});

describe("routing and CSP", () => {
  it("keeps only sign-in, setup and health public", () => {
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/api/health")).toBe(true);
    expect(isPublicPath("/api/chat")).toBe(false);
    expect(isPublicPath("/settings")).toBe(false);
    expect(isPublicPath("/loginx")).toBe(false);
  });

  it("allows scripts only with the per-request nonce", () => {
    const csp = buildCsp("abc123", { dev: false, https: true });
    expect(csp).toContain("script-src 'self' 'nonce-abc123' 'strict-dynamic'");
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("upgrade-insecure-requests");
    expect(buildCsp("n", { dev: false, https: false })).not.toContain("upgrade-insecure-requests");
  });
});
