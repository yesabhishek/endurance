import { afterEach, describe, expect, it } from "vitest";
import { getEnv, resetEnvCache } from "./env";

const original = { ...process.env };

afterEach(() => {
  process.env = { ...original };
  resetEnvCache();
});

describe("configuration", () => {
  it("refuses short or placeholder secrets", () => {
    process.env.APP_SECRET = "too-short";
    resetEnvCache();
    expect(() => getEnv()).toThrow(/APP_SECRET: must be at least 32 characters/);

    process.env.APP_SECRET = "replace-with-a-long-random-local-secret-value";
    resetEnvCache();
    expect(() => getEnv()).toThrow(/placeholder/);
  });

  it("accepts the legacy APP_ENCRYPTION_KEY name", () => {
    delete process.env.APP_SECRET;
    process.env.APP_ENCRYPTION_KEY = "legacy-key-legacy-key-legacy-key-0123456789";
    resetEnvCache();
    expect(getEnv().APP_SECRET).toBe("legacy-key-legacy-key-legacy-key-0123456789");
  });

  it("keeps sign-ups closed unless explicitly enabled", () => {
    resetEnvCache();
    expect(getEnv().ALLOW_SIGNUP).toBe(false);
    process.env.ALLOW_SIGNUP = "true";
    resetEnvCache();
    expect(getEnv().ALLOW_SIGNUP).toBe(true);
  });
});
