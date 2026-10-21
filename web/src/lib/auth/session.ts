import { cookies } from "next/headers";
import { cache } from "react";
import type { User } from "@prisma/client";
import { randomToken, sha256Hex } from "@/lib/crypto";
import { getDb } from "@/lib/db";
import { isHttps } from "@/lib/env";
import { SESSION_COOKIE } from "./cookie-name";

export { SESSION_COOKIE };
const SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const RENEW_AFTER_MS = 24 * 60 * 60 * 1000;

export type SessionUser = Pick<User, "id" | "email" | "name" | "role">;

export function sessionCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    secure: isHttps(),
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

/** Creates a server-side session and sets its cookie. Call from a route handler or server action. */
export async function startSession(userId: string, meta: { ip?: string | null; userAgent?: string | null }) {
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await getDb().session.create({
    data: {
      id: sha256Hex(token),
      userId,
      expiresAt,
      ip: meta.ip ?? null,
      userAgent: meta.userAgent?.slice(0, 300) ?? null,
    },
  });

  const store = await cookies();
  store.set(SESSION_COOKIE, token, sessionCookieOptions(SESSION_TTL_MS / 1000));
}

export async function endSession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await getDb().session.deleteMany({ where: { id: sha256Hex(token) } });
  }
  store.set(SESSION_COOKIE, "", sessionCookieOptions(0));
}

export async function endAllSessions(userId: string) {
  await getDb().session.deleteMany({ where: { userId } });
}

/** The signed-in user for this request, or null. Memoized per request. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token || token.length > 128) return null;

  const db = getDb();
  const session = await db.session.findUnique({
    where: { id: sha256Hex(token) },
    include: { user: { select: { id: true, email: true, name: true, role: true } } },
  });
  if (!session) return null;

  const now = Date.now();
  if (session.expiresAt.getTime() <= now) {
    await db.session.deleteMany({ where: { id: session.id } });
    return null;
  }

  // Sliding expiry, written at most once a day per session.
  if (now - session.lastSeenAt.getTime() > RENEW_AFTER_MS) {
    await db.session.update({
      where: { id: session.id },
      data: { lastSeenAt: new Date(now), expiresAt: new Date(now + SESSION_TTL_MS) },
    });
  }

  return session.user;
});

export async function userCount() {
  return getDb().user.count();
}
