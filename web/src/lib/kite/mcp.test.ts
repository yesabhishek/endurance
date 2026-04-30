import { describe, expect, it } from "vitest";
import { asArray, isKiteAlreadyLoggedIn, parseMcpResult } from "./mcp";

describe("kite MCP helpers", () => {
  it("parses text JSON MCP results", () => {
    const parsed = parseMcpResult({
      content: [{ type: "text", text: JSON.stringify([{ tradingsymbol: "INFY" }]) }],
    });

    expect(parsed).toEqual([{ tradingsymbol: "INFY" }]);
  });

  it("returns arrays from common response wrappers", () => {
    expect(asArray([{ a: 1 }])).toHaveLength(1);
    expect(asArray({ data: [{ a: 1 }] })).toHaveLength(1);
    expect(asArray({ holdings: [{ a: 1 }] })).toHaveLength(1);
    expect(asArray({ nope: [] })).toHaveLength(0);
  });

  it("detects already-authenticated Kite login responses", () => {
    expect(isKiteAlreadyLoggedIn("You are already logged in as Abhishek Choudhury")).toBe(true);
    expect(isKiteAlreadyLoggedIn("Please log in with this URL")).toBe(false);
  });
});
