import { describe, expect, it } from "vitest";
import { TENANT_MODELS, scopeArgs } from "./db";

describe("tenant scoping", () => {
  it("covers every user-owned model and leaves identity and reference tables alone", () => {
    for (const model of ["Holding", "Credential", "ChatMessage", "Transaction", "SyncRun", "OAuthToken", "Position", "UserSettings"] as const) {
      expect(TENANT_MODELS.has(model)).toBe(true);
    }
    for (const model of ["User", "Session", "Security", "AuditEvent"] as const) {
      expect(TENANT_MODELS.has(model)).toBe(false);
    }
  });

  it("adds the bound user to every filter, overriding any userId the caller passed", () => {
    expect(scopeArgs("findMany", { where: { userId: "attacker", symbol: "INFY" } }, "user-1")).toEqual({ where: { userId: "user-1", symbol: "INFY" } });
    expect(scopeArgs("count", undefined, "user-1")).toEqual({ where: { userId: "user-1" } });
    expect(scopeArgs("deleteMany", { where: {} }, "user-1")).toEqual({ where: { userId: "user-1" } });
    expect(scopeArgs("findUnique", { where: { id: "h1" } }, "user-1")).toEqual({ where: { id: "h1", userId: "user-1" } });
  });

  it("stamps creates with the bound user", () => {
    expect(scopeArgs("create", { data: { userId: "attacker", title: "x" } }, "user-1")).toEqual({ data: { userId: "user-1", title: "x" } });
    expect(scopeArgs("createMany", { data: [{ symbol: "A" }, { symbol: "B", userId: "attacker" }] }, "user-1")).toEqual({
      data: [
        { symbol: "A", userId: "user-1" },
        { symbol: "B", userId: "user-1" },
      ],
    });
  });

  it("never lets an update move a row to another user", () => {
    expect(scopeArgs("update", { where: { id: "h1" }, data: { userId: "attacker", quantity: 5 } }, "user-1")).toEqual({
      where: { id: "h1", userId: "user-1" },
      data: { quantity: 5 },
    });
    expect(scopeArgs("upsert", { where: { id: "h1" }, create: { userId: "attacker" }, update: { userId: "attacker", a: 1 } }, "user-1")).toEqual({
      where: { id: "h1", userId: "user-1" },
      create: { userId: "user-1" },
      update: { a: 1 },
    });
  });
});
