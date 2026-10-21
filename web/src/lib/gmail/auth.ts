import { google } from "googleapis";
import { decrypt, encrypt } from "@/lib/crypto";
import type { TenantDb } from "@/lib/db";
import { appUrl, getEnv } from "@/lib/env";

export const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/gmail.readonly",
];

export function gmailRedirectUri() {
  return new URL("/api/gmail/callback", appUrl()).toString();
}

export function getGoogleOAuthClient() {
  const env = getEnv();
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    throw new Error("Gmail is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.");
  }
  return new google.auth.OAuth2(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, gmailRedirectUri());
}

/** Builds the consent URL with a CSRF state and a PKCE challenge. */
export async function startGoogleOAuth(state: string) {
  const client = getGoogleOAuthClient();
  const { codeVerifier, codeChallenge } = await client.generateCodeVerifierAsync();
  const url = client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    response_type: "code",
    scope: GMAIL_SCOPES,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256" as never,
  });
  return { url, codeVerifier };
}

function tokenContext(userId: string, connectedAccountId: string, kind: "access" | "refresh") {
  return `gmail-${kind}:${userId}:${connectedAccountId}`;
}

export async function completeGoogleOAuth(db: TenantDb, userId: string, code: string, codeVerifier: string) {
  const client = getGoogleOAuthClient();
  const { tokens } = await client.getToken({ code, codeVerifier });
  client.setCredentials(tokens);

  const profile = await google.oauth2({ auth: client, version: "v2" }).userinfo.get();
  const email = profile.data.email?.toLowerCase();
  if (!email) throw new Error("Google did not return an email address for this account.");

  const account = await db.connectedAccount.upsert({
    where: { userId_provider_externalId: { userId, provider: "GMAIL", externalId: email } },
    update: { displayName: email, status: "CONNECTED", scope: tokens.scope ?? null, connectedAt: new Date() },
    create: { userId, provider: "GMAIL", externalId: email, displayName: email, status: "CONNECTED", scope: tokens.scope ?? null },
  });

  const existing = await db.oAuthToken.findUnique({ where: { connectedAccountId: account.id } });
  const data = {
    accessTokenEncrypted: tokens.access_token ? encrypt(tokens.access_token, tokenContext(userId, account.id, "access")) : null,
    // Google only returns a refresh token on first consent; keep the old one otherwise.
    refreshTokenEncrypted: tokens.refresh_token
      ? encrypt(tokens.refresh_token, tokenContext(userId, account.id, "refresh"))
      : existing?.refreshTokenEncrypted ?? null,
    expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
    scope: tokens.scope ?? null,
  };
  await db.oAuthToken.upsert({
    where: { connectedAccountId: account.id },
    update: data,
    create: { userId, connectedAccountId: account.id, ...data },
  });
  return account;
}

export async function getAuthorizedGmailClient(db: TenantDb, userId: string) {
  const account = await db.connectedAccount.findFirst({
    where: { userId, provider: "GMAIL", status: "CONNECTED" },
    include: { token: true },
    orderBy: { connectedAt: "desc" },
  });
  const token = account?.token;
  if (!account || !token) throw new Error("Spending data is not connected.");

  const client = getGoogleOAuthClient();
  client.setCredentials({
    access_token: token.accessTokenEncrypted ? decrypt(token.accessTokenEncrypted, tokenContext(userId, account.id, "access")) : undefined,
    refresh_token: token.refreshTokenEncrypted ? decrypt(token.refreshTokenEncrypted, tokenContext(userId, account.id, "refresh")) : undefined,
    expiry_date: token.expiresAt?.getTime(),
  });

  client.on("tokens", (next) => {
    void db.oAuthToken.update({
      where: { connectedAccountId: account.id },
      data: {
        accessTokenEncrypted: next.access_token ? encrypt(next.access_token, tokenContext(userId, account.id, "access")) : undefined,
        refreshTokenEncrypted: next.refresh_token ? encrypt(next.refresh_token, tokenContext(userId, account.id, "refresh")) : undefined,
        expiresAt: next.expiry_date ? new Date(next.expiry_date) : undefined,
      },
    });
  });

  return { account, gmail: google.gmail({ auth: client, version: "v1" }) };
}
