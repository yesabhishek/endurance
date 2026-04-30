import { google } from "googleapis";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { getDb } from "@/lib/db";

export const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/gmail.readonly",
];

export function getGoogleOAuthClient(redirectUri?: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are required.");
  }

  return new google.auth.OAuth2(
    clientId,
    clientSecret,
    redirectUri ?? process.env.GOOGLE_REDIRECT_URI,
  );
}

export function getGoogleAuthUrl(redirectUri: string) {
  return getGoogleOAuthClient(redirectUri).generateAuthUrl({
    access_type: "offline",
    include_granted_scopes: true,
    prompt: "consent",
    response_type: "code",
    scope: GMAIL_SCOPES,
  });
}

export async function completeGoogleOAuth(code: string, redirectUri: string) {
  const oauth2 = getGoogleOAuthClient(redirectUri);
  const { tokens } = await oauth2.getToken(code);
  oauth2.setCredentials(tokens);

  const oauth2Api = google.oauth2({ auth: oauth2, version: "v2" });
  const profile = await oauth2Api.userinfo.get();
  const accountEmail = profile.data.email ?? "gmail";

  const db = getDb();
  const connectedAccount = await db.connectedAccount.upsert({
    where: {
      provider_accountEmail: {
        provider: "GMAIL",
        accountEmail,
      },
    },
    update: {
      displayName: profile.data.name,
      status: "connected",
      scope: tokens.scope ?? GMAIL_SCOPES.join(" "),
    },
    create: {
      provider: "GMAIL",
      accountEmail,
      displayName: profile.data.name,
      status: "connected",
      scope: tokens.scope ?? GMAIL_SCOPES.join(" "),
    },
  });

  await db.oAuthToken.create({
    data: {
      connectedAccountId: connectedAccount.id,
      accessTokenEncrypted: encryptSecret(tokens.access_token),
      refreshTokenEncrypted: encryptSecret(tokens.refresh_token),
      expiryDate: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      scope: tokens.scope ?? GMAIL_SCOPES.join(" "),
    },
  });

  return connectedAccount;
}

export async function getAuthorizedGmailClient() {
  const db = getDb();
  const account = await db.connectedAccount.findFirst({
    where: { provider: "GMAIL", status: "connected" },
    include: { tokens: { orderBy: { createdAt: "desc" }, take: 1 } },
  });

  const token = account?.tokens[0];
  if (!account || !token) {
    throw new Error("Spending Data is not connected.");
  }

  const oauth2 = getGoogleOAuthClient();
  oauth2.setCredentials({
    access_token: decryptSecret(token.accessTokenEncrypted) ?? undefined,
    refresh_token: decryptSecret(token.refreshTokenEncrypted) ?? undefined,
    expiry_date: token.expiryDate?.getTime(),
    scope: token.scope ?? undefined,
  });

  oauth2.on("tokens", async (nextTokens) => {
    await db.oAuthToken.create({
      data: {
        connectedAccountId: account.id,
        accessTokenEncrypted: encryptSecret(nextTokens.access_token),
        refreshTokenEncrypted: encryptSecret(nextTokens.refresh_token) ?? token.refreshTokenEncrypted,
        expiryDate: nextTokens.expiry_date ? new Date(nextTokens.expiry_date) : null,
        scope: nextTokens.scope ?? token.scope,
      },
    });
  });

  return {
    account,
    gmail: google.gmail({ auth: oauth2, version: "v1" }),
  };
}
