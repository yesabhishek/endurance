import { NextResponse } from "next/server";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { getDummyHash, verifyPassword } from "@/lib/auth/password";
import { startSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { HttpError, clientMeta, readJson, withApi } from "@/lib/http";
import { clearRateLimit, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

const bodySchema = z.object({
  email: z.string().trim().toLowerCase().max(254),
  password: z.string().min(1).max(256),
});

const INVALID = "That email and password don't match an account.";

export const POST = withApi(async (request) => {
  const meta = clientMeta(request);
  const { email, password } = await readJson(request, bodySchema);

  // Throttle by account always, and by address when we know it (TRUST_PROXY=true behind
  // a proxy). Without a known address a shared bucket would let anyone lock out everyone.
  const [byIp, byEmail] = await Promise.all([
    meta.ip ? rateLimit("login", `ip:${meta.ip}`) : Promise.resolve({ ok: true, retryAfter: 0 }),
    rateLimit("login", `email:${email}`),
  ]);
  if (!byIp.ok || !byEmail.ok) {
    const minutes = Math.ceil(Math.max(byIp.retryAfter, byEmail.retryAfter) / 60);
    throw new HttpError(429, `Too many sign-in attempts. Try again in ${minutes} minutes.`);
  }

  const user = await getDb().user.findUnique({ where: { email } });
  // Always run one hash so response time doesn't reveal whether the email exists.
  const valid = await verifyPassword(password, user?.passwordHash ?? (await getDummyHash()));

  if (!user || !valid) {
    await audit("auth.login_failed", { userId: user?.id, ...meta, metadata: { email } });
    throw new HttpError(401, INVALID);
  }

  await clearRateLimit("login", `email:${email}`);
  await audit("auth.login", { userId: user.id, ...meta });
  await startSession(user.id, meta);
  return NextResponse.json({ ok: true });
});
