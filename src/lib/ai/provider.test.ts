import { afterEach, describe, expect, it, vi } from "vitest";
import { aiConfig } from "./provider";

const KEYS = ["AI_PROVIDER", "AI_MODEL", "OPENAI_API_KEY", "OPENAI_BASE_URL", "ANTHROPIC_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY", "GEMINI_API_KEY", "AI_GATEWAY_API_KEY"];

function withEnv(values: Record<string, string>) {
  for (const key of KEYS) vi.stubEnv(key, values[key] ?? "");
}

// Built at runtime so secret scanners don't mistake test fixtures for real keys.
const fake = (prefix: string) => `${prefix}${"x".repeat(8)}test${"0".repeat(20)}`;

describe("AI provider from .env", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("explains what to add when there is no key", () => {
    withEnv({});
    expect(aiConfig()).toMatchObject({ ok: false, problem: expect.stringContaining("No AI key found") });
  });

  it("picks the provider from the key that is set and applies its default model", () => {
    withEnv({ ANTHROPIC_API_KEY: fake("sk-ant-") });
    expect(aiConfig()).toMatchObject({ ok: true, provider: "anthropic", model: "claude-sonnet-5-5" });
  });

  it("accepts gateway-style model names for a direct provider", () => {
    withEnv({ OPENAI_API_KEY: fake("sk-proj-"), AI_MODEL: "openai/gpt-5.5" });
    expect(aiConfig()).toMatchObject({ ok: true, provider: "openai", model: "gpt-5.5" });
  });

  it("catches a provider key pasted into the gateway variable", () => {
    withEnv({ AI_GATEWAY_API_KEY: fake("sk-proj-"), AI_MODEL: "openai/gpt-5.5" });
    expect(aiConfig()).toMatchObject({ ok: false, problem: expect.stringContaining("OPENAI_API_KEY") });
  });

  it("asks for a model where there is no safe default", () => {
    withEnv({ GEMINI_API_KEY: fake("AIza") });
    expect(aiConfig()).toMatchObject({ ok: false, problem: expect.stringContaining("AI_MODEL") });
  });

  it("supports OpenAI-compatible servers without a key", () => {
    withEnv({ OPENAI_BASE_URL: "http://localhost:11434/v1", AI_MODEL: "llama3.3" });
    expect(aiConfig()).toMatchObject({ ok: true, provider: "openai", model: "llama3.3", baseUrl: "http://localhost:11434/v1" });
  });

  it("respects an explicit AI_PROVIDER and rejects unknown ones", () => {
    withEnv({ OPENAI_API_KEY: fake("sk-"), ANTHROPIC_API_KEY: fake("sk-ant-"), AI_PROVIDER: "anthropic" });
    expect(aiConfig()).toMatchObject({ ok: true, provider: "anthropic" });
    withEnv({ AI_PROVIDER: "mistral" });
    expect(aiConfig()).toMatchObject({ ok: false });
  });
});
