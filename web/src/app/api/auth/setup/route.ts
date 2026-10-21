import { NextResponse } from "next/server";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { hashPassword, passwordProblem } from "@/lib/auth/password";
import { startSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { HttpError, clientMeta, readJson, withApi } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

const bodySchema = z.object({
  name: z.string().trim().max(80).optional(),
  email: z.email().max(254).transform((value) => value.trim().toLowerCase()),
  password: z.string().min(1).max(256),
});

// Creates the first account (the owner). Afterwards it only accepts new accounts
// when ALLOW_SIGNUP=true, for installs shared by a household or team.
export const POST = withApi(async (request) => {
  const meta = clientMeta(request);
  const limit = await rateLimit("setup", meta.ip ?? "unknown");
  if (!limit.ok) throw new HttpError(429, `Too many attempts. Try again in ${Math.ceil(limit.retryAfter / 60)} minutes.`);

  const { name, email, password } = await readJson(request, bodySchema);
  const problem = passwordProblem(password, email);
  if (problem) throw new HttpError(400, problem);

  const passwordHash = await hashPassword(password);
  const db = getDb();

  const user = await db.$transaction(async (tx) => {
    // Serialize concurrent setup requests so only one can become the owner.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(72710001)`;
    const existing = await tx.user.count();
    if (existing > 0 && !getEnv().ALLOW_SIGNUP) {
      throw new HttpError(403, "This install already has an owner. Ask them to enable sign-ups.");
    }
    if (await tx.user.findUnique({ where: { email } })) {
      throw new HttpError(409, "An account with this email already exists. Sign in instead.");
    }
    return tx.user.create({
      data: {
        email,
        name: name || null,
        passwordHash,
        role: existing === 0 ? "OWNER" : "MEMBER",
        settings: { create: {} },
      },
    });
  });

  await audit(user.role === "OWNER" ? "auth.setup" : "auth.signup", { userId: user.id, ...meta });
  await startSession(user.id, meta);
  return NextResponse.json({ ok: true });
});
