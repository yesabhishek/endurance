import { NextResponse } from "next/server";
import { z } from "zod";
import { generateAiForecast, peekAiForecast } from "@/lib/ai/forecast";
import { PROVIDERS, chatModel } from "@/lib/ai/providers";
import { requireApiUser } from "@/lib/auth/guard";
import { isAiKind, readCredential } from "@/lib/credentials";
import { getPortfolio } from "@/lib/finance/portfolio";
import { HttpError, jsonError, readJson, withApi } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

const bodySchema = z.object({ refresh: z.boolean().optional() }).strict();

// Asks the user's chosen model for 20-year assumptions. The projection itself
// runs in the browser from these numbers, so the chart and the math stay visible.
export const POST = withApi(async (request) => {
  const { user, db } = await requireApiUser();
  const { refresh } = await readJson(request, bodySchema);

  const settings = await db.userSettings.findUnique({ where: { userId: user.id } });
  if (!settings?.aiDataConsentAt) {
    return NextResponse.json({ error: "Confirm that portfolio data may be sent to your AI provider.", code: "consent_required" }, { status: 409 });
  }
  const provider = settings.chatProvider;
  const modelId = settings.chatModel;
  if (!provider || !isAiKind(provider) || !modelId) return jsonError(400, "Add an AI provider key in Settings and choose a model.");

  const credential = await readCredential(db, user.id, provider);
  if (!credential) return jsonError(400, `Your ${PROVIDERS[provider].label} key was removed. Add it again in Settings.`);

  const portfolio = await getPortfolio(db, user.id);
  if (!portfolio.holdings.length) return jsonError(400, "Connect Kite and sync your holdings first.");

  // Cached answers are free; only count calls that may reach the provider.
  if (!refresh) {
    const hit = await peekAiForecast(user.id, modelId, portfolio);
    if (hit) return NextResponse.json({ ...hit, cached: true, providerLabel: PROVIDERS[provider].label });
  }
  const limit = await rateLimit("forecast", user.id);
  if (!limit.ok) throw new HttpError(429, `You've refreshed the AI forecast a lot this hour. Try again in ${Math.ceil(limit.retryAfter / 60)} minutes.`);

  try {
    const forecast = await generateAiForecast({ userId: user.id, model: chatModel(provider, credential.apiKey, modelId), modelId, portfolio, refresh: true });
    return NextResponse.json({ ...forecast, providerLabel: PROVIDERS[provider].label });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    console.error("[forecast] model error", message);
    if (/api key|unauthori[sz]ed|401|invalid.*key/i.test(message)) return jsonError(502, "Your AI provider rejected the key. Update it in Settings.");
    if (/quota|rate limit|429|credit/i.test(message)) return jsonError(502, "Your AI provider says you've hit a usage limit or run out of credit.");
    if (/schema|parse|json|no object/i.test(message)) return jsonError(502, `${modelId} didn't return usable numbers. Try again, or pick a different model in Settings.`);
    return jsonError(502, "The AI provider returned an error. Try again, or pick a different model.");
  }
});
