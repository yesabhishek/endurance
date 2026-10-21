import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth/guard";
import { AI_CREDENTIAL_KINDS } from "@/lib/credentials";
import { HttpError, readJson, withApi } from "@/lib/http";

export const runtime = "nodejs";

const bodySchema = z
  .object({
    chatProvider: z.enum(AI_CREDENTIAL_KINDS).optional(),
    chatModel: z.string().trim().min(1).max(120).regex(/^[\w.:/@-]+$/, "Model names use letters, numbers and . : / @ - only.").optional(),
    singleStockLimitPct: z.number().min(1).max(100).optional(),
    sectorLimitPct: z.number().min(1).max(100).optional(),
    aiDataConsent: z.literal(true).optional(),
  })
  .strict();

export const PATCH = withApi(async (request) => {
  const { user, db } = await requireApiUser();
  const body = await readJson(request, bodySchema);

  if (body.chatProvider) {
    const credential = await db.credential.findUnique({ where: { userId_kind: { userId: user.id, kind: body.chatProvider } } });
    if (!credential) throw new HttpError(400, "Add a key for that provider before choosing it.");
  }

  const data = {
    ...(body.chatProvider ? { chatProvider: body.chatProvider } : {}),
    ...(body.chatModel ? { chatModel: body.chatModel } : {}),
    ...(body.singleStockLimitPct ? { singleStockLimitPct: body.singleStockLimitPct } : {}),
    ...(body.sectorLimitPct ? { sectorLimitPct: body.sectorLimitPct } : {}),
    ...(body.aiDataConsent ? { aiDataConsentAt: new Date() } : {}),
  };
  const settings = await db.userSettings.upsert({
    where: { userId: user.id },
    update: data,
    create: { userId: user.id, ...data },
  });
  return NextResponse.json({
    ok: true,
    settings: {
      chatProvider: settings.chatProvider,
      chatModel: settings.chatModel,
      singleStockLimitPct: Number(settings.singleStockLimitPct),
      sectorLimitPct: Number(settings.sectorLimitPct),
      aiDataConsentAt: settings.aiDataConsentAt,
    },
  });
});
