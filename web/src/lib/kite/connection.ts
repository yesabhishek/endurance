import { decrypt, encrypt } from "@/lib/crypto";
import { readCredential } from "@/lib/credentials";
import type { TenantDb } from "@/lib/db";
import { invalidateAccessToken, nextKiteExpiry } from "./client";

function tokenContext(userId: string, connectedAccountId: string) {
  return `kite-token:${userId}:${connectedAccountId}`;
}

export type KiteConnectionState =
  | { state: "no-app" }
  | { state: "not-connected"; apiKey: string }
  | { state: "expired"; apiKey: string; displayName: string | null; externalId: string }
  | { state: "connected"; apiKey: string; displayName: string | null; externalId: string; expiresAt: Date | null };

export async function getKiteConnectionState(db: TenantDb, userId: string): Promise<KiteConnectionState> {
  const app = await readCredential(db, userId, "KITE_APP");
  if (!app) return { state: "no-app" };

  const account = await db.connectedAccount.findFirst({
    where: { userId, provider: "KITE", status: { not: "DISCONNECTED" } },
    include: { token: true },
    orderBy: { connectedAt: "desc" },
  });
  if (!account) return { state: "not-connected", apiKey: app.apiKey };

  const expired = account.status === "EXPIRED" || !account.token?.accessTokenEncrypted || (account.token.expiresAt && account.token.expiresAt <= new Date());
  if (expired) return { state: "expired", apiKey: app.apiKey, displayName: account.displayName, externalId: account.externalId };
  return { state: "connected", apiKey: app.apiKey, displayName: account.displayName, externalId: account.externalId, expiresAt: account.token?.expiresAt ?? null };
}

/** The live access token for sync, or null when the user must log in again. */
export async function getKiteSession(db: TenantDb, userId: string) {
  const app = await readCredential(db, userId, "KITE_APP");
  if (!app) return null;
  const account = await db.connectedAccount.findFirst({
    where: { userId, provider: "KITE", status: "CONNECTED" },
    include: { token: true },
    orderBy: { connectedAt: "desc" },
  });
  const token = account?.token;
  if (!account || !token?.accessTokenEncrypted) return null;
  if (token.expiresAt && token.expiresAt <= new Date()) {
    await markKiteExpired(db, userId, account.id);
    return null;
  }
  return {
    account,
    apiKey: app.apiKey,
    accessToken: decrypt(token.accessTokenEncrypted, tokenContext(userId, account.id)),
  };
}

export async function storeKiteSession(
  db: TenantDb,
  userId: string,
  session: { accessToken: string; kiteUserId: string; displayName: string },
) {
  // One Kite account per user: retire any other account this user connected before.
  await db.connectedAccount.updateMany({
    where: { userId, provider: "KITE", externalId: { not: session.kiteUserId } },
    data: { status: "DISCONNECTED" },
  });

  const account = await db.connectedAccount.upsert({
    where: { userId_provider_externalId: { userId, provider: "KITE", externalId: session.kiteUserId } },
    update: { displayName: session.displayName, status: "CONNECTED", connectedAt: new Date() },
    create: { userId, provider: "KITE", externalId: session.kiteUserId, displayName: session.displayName, status: "CONNECTED" },
  });

  const tokenData = {
    accessTokenEncrypted: encrypt(session.accessToken, tokenContext(userId, account.id)),
    expiresAt: nextKiteExpiry(),
  };
  await db.oAuthToken.upsert({
    where: { connectedAccountId: account.id },
    update: tokenData,
    create: { userId, connectedAccountId: account.id, ...tokenData },
  });
  return account;
}

export async function markKiteExpired(db: TenantDb, userId: string, connectedAccountId: string) {
  await db.connectedAccount.updateMany({ where: { id: connectedAccountId, userId }, data: { status: "EXPIRED" } });
  await db.oAuthToken.updateMany({ where: { connectedAccountId, userId }, data: { accessTokenEncrypted: null } });
}

/** Ends the Kite session on Zerodha's side and forgets the token. Keeps synced data. */
export async function disconnectKite(db: TenantDb, userId: string) {
  const session = await getKiteSession(db, userId).catch(() => null);
  if (session) await invalidateAccessToken(session.apiKey, session.accessToken);
  const accounts = await db.connectedAccount.findMany({ where: { userId, provider: "KITE" }, select: { id: true } });
  for (const account of accounts) {
    await db.oAuthToken.deleteMany({ where: { connectedAccountId: account.id, userId } });
  }
  await db.connectedAccount.updateMany({ where: { userId, provider: "KITE" }, data: { status: "DISCONNECTED" } });
}
