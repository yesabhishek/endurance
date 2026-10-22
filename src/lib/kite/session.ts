import { isDemo, kiteKeys } from "@/lib/config";
import { readJson, removeJson, writeJson } from "@/lib/store";
import { invalidateAccessToken, nextKiteExpiry } from "./client";

// Kite access tokens last until about 6 AM IST the next morning. We keep today's
// token in .data/kite-session.json (mode 600) so a restart doesn't log you out.

type StoredSession = {
  accessToken: string | null;
  userId: string;
  userName: string;
  connectedAt: string;
  expiresAt: string;
};

const FILE = "kite-session.json";

export type KiteStatus =
  | { state: "demo"; userId: string; userName: string }
  | { state: "no-keys" }
  | { state: "logged-out" }
  | { state: "expired"; userId: string; userName: string }
  | { state: "connected"; userId: string; userName: string; expiresAt: string };

export async function kiteStatus(): Promise<KiteStatus> {
  if (isDemo()) return { state: "demo", userId: "DEMO01", userName: "Demo investor" };
  if (!kiteKeys()) return { state: "no-keys" };
  const session = await readJson<StoredSession>(FILE);
  if (!session) return { state: "logged-out" };
  if (!session.accessToken || Date.parse(session.expiresAt) <= Date.now()) {
    return { state: "expired", userId: session.userId, userName: session.userName };
  }
  return { state: "connected", userId: session.userId, userName: session.userName, expiresAt: session.expiresAt };
}

/** Today's API key and access token, or null when you need to log in to Kite again. */
export async function activeSession() {
  const keys = kiteKeys();
  if (!keys || isDemo()) return null;
  const session = await readJson<StoredSession>(FILE);
  if (!session?.accessToken || Date.parse(session.expiresAt) <= Date.now()) return null;
  return { apiKey: keys.apiKey, accessToken: session.accessToken, userId: session.userId, userName: session.userName };
}

export async function saveSession(session: { accessToken: string; kiteUserId: string; displayName: string }) {
  const stored: StoredSession = {
    accessToken: session.accessToken,
    userId: session.kiteUserId,
    userName: session.displayName,
    connectedAt: new Date().toISOString(),
    expiresAt: nextKiteExpiry().toISOString(),
  };
  await writeJson(FILE, stored);
}

/** Kite rejected the token (it was flushed early or revoked). Forget it but remember who you were. */
export async function markExpired() {
  const session = await readJson<StoredSession>(FILE);
  if (session) await writeJson(FILE, { ...session, accessToken: null, expiresAt: new Date().toISOString() });
}

/** Ends the session on Zerodha's side too. Your saved snapshot and chats stay. */
export async function logout() {
  const active = await activeSession();
  if (active) await invalidateAccessToken(active.apiKey, active.accessToken);
  await removeJson(FILE);
}
