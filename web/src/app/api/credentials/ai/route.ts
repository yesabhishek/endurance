import { NextResponse } from "next/server";
import { z } from "zod";
import { ProviderKeyError, keyShapeProblem, listModels } from "@/lib/ai/providers";
import { audit } from "@/lib/audit";
import { requireApiUser } from "@/lib/auth/guard";
import { AI_CREDENTIAL_KINDS, deleteCredential, readCredential, saveCredential } from "@/lib/credentials";
import { HttpError, clientMeta, readJson, withApi } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

const kindSchema = z.enum(AI_CREDENTIAL_KINDS);

// Verifies a provider key by listing its models, then stores it encrypted.
export const POST = withApi(async (request) => {
  const { user, db } = await requireApiUser();
  const limit = await rateLimit("credentialTest", user.id);
  if (!limit.ok) throw new HttpError(429, "Too many key checks. Wait a few minutes and try again.");

  const { kind, apiKey } = await readJson(request, z.object({ kind: kindSchema, apiKey: z.string().trim().min(1).max(400) }));
  const problem = keyShapeProblem(kind, apiKey);
  if (problem) throw new HttpError(400, problem);

  let models: string[];
  try {
    models = await listModels(kind, apiKey);
  } catch (error) {
    if (error instanceof ProviderKeyError) throw new HttpError(400, error.message);
    throw error;
  }

  const credential = await saveCredential(db, user.id, kind, { apiKey });

  // First key added becomes the chat default.
  const settings = await db.userSettings.findUnique({ where: { userId: user.id } });
  if (!settings?.chatProvider && models[0]) {
    await db.userSettings.upsert({
      where: { userId: user.id },
      update: { chatProvider: kind, chatModel: models[0] },
      create: { userId: user.id, chatProvider: kind, chatModel: models[0] },
    });
  }

  await audit("credential.saved", { userId: user.id, ...clientMeta(request), metadata: { kind } });
  return NextResponse.json({ ok: true, credential, models });
});

// Lists models for a saved key (used by the chat model picker).
export const GET = withApi(async (request) => {
  const { user, db } = await requireApiUser();
  const kind = kindSchema.safeParse(new URL(request.url).searchParams.get("kind"));
  if (!kind.success) throw new HttpError(400, "Choose a provider.");

  const limit = await rateLimit("credentialTest", user.id);
  if (!limit.ok) throw new HttpError(429, "Too many requests. Wait a few minutes and try again.");

  const secret = await readCredential(db, user.id, kind.data);
  if (!secret) throw new HttpError(404, "Add a key for this provider first.");
  try {
    return NextResponse.json({ models: await listModels(kind.data, secret.apiKey) });
  } catch (error) {
    if (error instanceof ProviderKeyError) throw new HttpError(400, error.message);
    throw error;
  }
});

export const DELETE = withApi(async (request) => {
  const { user, db } = await requireApiUser();
  const { kind } = await readJson(request, z.object({ kind: kindSchema }));
  await deleteCredential(db, user.id, kind);

  const settings = await db.userSettings.findUnique({ where: { userId: user.id } });
  if (settings?.chatProvider === kind) {
    await db.userSettings.update({ where: { userId: user.id }, data: { chatProvider: null, chatModel: null } });
  }
  await audit("credential.deleted", { userId: user.id, ...clientMeta(request), metadata: { kind } });
  return NextResponse.json({ ok: true });
});
