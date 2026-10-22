import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createGateway, type LanguageModel } from "ai";
import { env } from "@/lib/config";

// The assistant uses whichever AI key you put in .env. Set AI_PROVIDER to choose
// when you have more than one, and AI_MODEL to pick a model.

export type ProviderId = "openai" | "anthropic" | "google" | "gateway";

type ProviderInfo = { label: string; keyNames: string[]; defaultModel: string | null; example: string };

export const PROVIDERS: Record<ProviderId, ProviderInfo> = {
  openai: { label: "OpenAI", keyNames: ["OPENAI_API_KEY"], defaultModel: "gpt-5.5", example: "gpt-5.5" },
  anthropic: { label: "Anthropic", keyNames: ["ANTHROPIC_API_KEY"], defaultModel: "claude-sonnet-5-5", example: "claude-sonnet-5-5" },
  google: { label: "Google Gemini", keyNames: ["GOOGLE_GENERATIVE_AI_API_KEY", "GEMINI_API_KEY"], defaultModel: null, example: "a Gemini model id from ai.google.dev/gemini-api/docs/models" },
  gateway: { label: "Vercel AI Gateway", keyNames: ["AI_GATEWAY_API_KEY"], defaultModel: null, example: "anthropic/claude-sonnet-5-5" },
};

const ORDER: ProviderId[] = ["openai", "anthropic", "google", "gateway"];

export type AiConfig =
  | { ok: true; provider: ProviderId; label: string; model: string; apiKey: string; baseUrl: string | null }
  | { ok: false; problem: string };

function keyFor(provider: ProviderId) {
  for (const name of PROVIDERS[provider].keyNames) {
    const value = env(name);
    if (value) return value;
  }
  return undefined;
}

export function aiConfig(): AiConfig {
  const explicit = env("AI_PROVIDER")?.toLowerCase();
  if (explicit && !(explicit in PROVIDERS)) {
    return { ok: false, problem: `AI_PROVIDER is "${explicit}". Use one of: ${ORDER.join(", ")}.` };
  }

  // An OpenAI-compatible server (OpenRouter, Ollama, LM Studio, Groq...) needs a base URL and maybe no key.
  const baseUrl = env("OPENAI_BASE_URL") ?? null;
  const provider = (explicit as ProviderId | undefined) ?? ORDER.find((id) => keyFor(id)) ?? (baseUrl ? "openai" : undefined);
  if (!provider) {
    return { ok: false, problem: "No AI key found. Add OPENAI_API_KEY, ANTHROPIC_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY or AI_GATEWAY_API_KEY to .env and restart." };
  }

  const info = PROVIDERS[provider];
  const apiKey = keyFor(provider) ?? (provider === "openai" && baseUrl ? "not-needed" : undefined);
  if (!apiKey) return { ok: false, problem: `AI_PROVIDER is ${provider}, but ${info.keyNames[0]} is empty in .env.` };

  if (provider === "gateway" && /^sk-(proj-|ant-)?/.test(apiKey)) {
    return { ok: false, problem: "AI_GATEWAY_API_KEY holds a provider key (it starts with sk-). Move it to OPENAI_API_KEY or ANTHROPIC_API_KEY instead." };
  }

  let model = env("AI_MODEL") ?? info.defaultModel;
  if (!model) return { ok: false, problem: `Set AI_MODEL in .env for ${info.label}, for example ${info.example}.` };
  // "openai/gpt-5.5" is gateway syntax; talking to OpenAI directly wants "gpt-5.5".
  if (provider !== "gateway" && !baseUrl) model = model.replace(new RegExp(`^${provider}/`), "");

  return { ok: true, provider, label: baseUrl ? `OpenAI-compatible (${new URL(baseUrl).host})` : info.label, model, apiKey, baseUrl };
}

export function languageModel(config: Extract<AiConfig, { ok: true }>): LanguageModel {
  switch (config.provider) {
    case "openai":
      // Compatible servers speak Chat Completions; OpenAI itself gets the Responses API.
      // The base URL is always passed: the SDK would otherwise read OPENAI_BASE_URL itself,
      // and an empty value in .env breaks every request.
      return config.baseUrl
        ? createOpenAI({ apiKey: config.apiKey, baseURL: config.baseUrl }).chat(config.model)
        : createOpenAI({ apiKey: config.apiKey, baseURL: "https://api.openai.com/v1" })(config.model);
    case "anthropic":
      return createAnthropic({ apiKey: config.apiKey })(config.model);
    case "google":
      return createGoogleGenerativeAI({ apiKey: config.apiKey })(config.model);
    case "gateway":
      return createGateway({ apiKey: config.apiKey })(config.model);
  }
}
