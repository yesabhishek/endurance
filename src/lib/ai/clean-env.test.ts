import { afterEach, describe, expect, it, vi } from "vitest";

describe("empty base URLs in .env", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("do not stop the AI providers from loading", async () => {
    // .env.example ships OPENAI_BASE_URL= with no value.
    vi.stubEnv("OPENAI_BASE_URL", "");
    vi.stubEnv("ANTHROPIC_BASE_URL", "  ");
    vi.resetModules();
    await expect(import("./provider")).resolves.toHaveProperty("languageModel");
    expect(process.env.OPENAI_BASE_URL).toBeUndefined();
  });

  it("leave a real base URL alone", async () => {
    vi.stubEnv("OPENAI_BASE_URL", "http://127.0.0.1:11434/v1");
    vi.resetModules();
    await import("./provider");
    expect(process.env.OPENAI_BASE_URL).toBe("http://127.0.0.1:11434/v1");
  });
});
