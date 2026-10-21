import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createGateway, type LanguageModel } from "ai";
import type { AiCredentialKind } from "@/lib/credentials";

export type ProviderInfo = {
  kind: AiCredentialKind;
  label: string;
  keyUrl: string;
  keyPrefix?: string;
  suggested: string[];
};

// `suggested` is only a fallback for the model menu; the real list comes from the provider.
export const PROVIDERS: Record<AiCredentialKind, ProviderInfo> = {
  OPENAI: {
    kind: "OPENAI",
    label: "OpenAI",
    keyUrl: "https://platform.openai.com/api-keys",
    keyPrefix: "sk-",
    suggested: ["gpt-5.4", "gpt-5.4-mini"],
  },
  ANTHROPIC: {
    kind: "ANTHROPIC",
    label: "Anthropic",
    keyUrl: "https://console.anthropic.com/settings/keys",
    keyPrefix: "sk-ant-",
    suggested: ["claude-sonnet-5-5", "claude-opus-5-5", "claude-haiku-5-5"],
  },
  GOOGLE: {
    kind: "GOOGLE",
    label: "Google Gemini",
    keyUrl: "https://aistudio.google.com/app/apikey",
    suggested: [],
  },
  AI_GATEWAY: {
    kind: "AI_GATEWAY",
    label: "Vercel AI Gateway",
    keyUrl: "https://vercel.com/docs/ai-gateway",
    suggested: ["anthropic/claude-sonnet-5-5", "openai/gpt-5.4"],
  },
};

export class ProviderKeyError extends Error {}

const TIMEOUT_MS = 12_000;

async function getJson(url: string, headers: Record<string, string>) {
  let response: Response;
  try {
    response = await fetch(url, { headers, signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
  } catch {
    throw new ProviderKeyError("The provider could not be reached. Check your connection and try again.");
  }
  if (response.status === 401 || response.status === 403) {
    throw new ProviderKeyError("The provider rejected this key. Check that it is active and copied in full.");
  }
  if (!response.ok) throw new ProviderKeyError(`The provider returned an error (HTTP ${response.status}).`);
  return (await response.json()) as Record<string, unknown>;
}

const OPENAI_EXCLUDE = /embedding|tts|whisper|dall-e|image|moderation|audio|realtime|transcribe|search|computer-use|codex|davinci|babbage/;

/** Confirms the key works and returns the chat models it can use, best first. */
export async function listModels(kind: AiCredentialKind, apiKey: string): Promise<string[]> {
  switch (kind) {
    case "OPENAI": {
      const body = await getJson("https://api.openai.com/v1/models", { Authorization: `Bearer ${apiKey}` });
      const ids = ((body.data as Array<{ id: string }>) ?? []).map((model) => model.id);
      return ids.filter((id) => /^(gpt-|o\d|chatgpt-)/.test(id) && !OPENAI_EXCLUDE.test(id)).sort().reverse();
    }
    case "ANTHROPIC": {
      const body = await getJson("https://api.anthropic.com/v1/models?limit=100", {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      });
      return ((body.data as Array<{ id: string }>) ?? []).map((model) => model.id);
    }
    case "GOOGLE": {
      const body = await getJson("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200", { "x-goog-api-key": apiKey });
      const models = (body.models as Array<{ name: string; supportedGenerationMethods?: string[] }>) ?? [];
      return models
        .filter((model) => model.supportedGenerationMethods?.includes("generateContent") && /gemini/.test(model.name) && !/embedding|image|tts|vision/.test(model.name))
        .map((model) => model.name.replace(/^models\//, ""))
        .sort()
        .reverse();
    }
    case "AI_GATEWAY": {
      const body = await getJson("https://ai-gateway.vercel.sh/v1/models", { Authorization: `Bearer ${apiKey}` });
      const models = (body.data as Array<{ id: string; type?: string }>) ?? [];
      return models.filter((model) => !model.type || model.type === "language").map((model) => model.id);
    }
  }
}

export function chatModel(kind: AiCredentialKind, apiKey: string, modelId: string): LanguageModel {
  switch (kind) {
    case "OPENAI":
      return createOpenAI({ apiKey })(modelId);
    case "ANTHROPIC":
      return createAnthropic({ apiKey })(modelId);
    case "GOOGLE":
      return createGoogleGenerativeAI({ apiKey })(modelId);
    case "AI_GATEWAY":
      return createGateway({ apiKey })(modelId);
  }
}

/** Basic shape check before any network call, so obvious paste mistakes fail fast. */
export function keyShapeProblem(kind: AiCredentialKind, apiKey: string) {
  const key = apiKey.trim();
  if (key.length < 20 || key.length > 400) return "That doesn't look like a complete API key.";
  if (/\s/.test(key)) return "The key contains spaces. Copy it again without extra characters.";
  const prefix = PROVIDERS[kind].keyPrefix;
  if (kind === "OPENAI" && prefix && !key.startsWith(prefix)) return "OpenAI keys start with sk-.";
  if (kind === "ANTHROPIC" && prefix && !key.startsWith(prefix)) return "Anthropic keys start with sk-ant-.";
  return null;
}
