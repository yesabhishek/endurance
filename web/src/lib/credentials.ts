import type { CredentialKind } from "@prisma/client";
import { decryptJson, encryptJson, isStaleCiphertext, secretHint } from "@/lib/crypto";
import type { TenantDb } from "@/lib/db";

export type KiteAppSecret = { apiKey: string; apiSecret: string };
export type ApiKeySecret = { apiKey: string };

type SecretFor<K extends CredentialKind> = K extends "KITE_APP" ? KiteAppSecret : ApiKeySecret;

export const AI_CREDENTIAL_KINDS = ["OPENAI", "ANTHROPIC", "GOOGLE", "AI_GATEWAY"] as const satisfies readonly CredentialKind[];
export type AiCredentialKind = (typeof AI_CREDENTIAL_KINDS)[number];

export function isAiKind(kind: string): kind is AiCredentialKind {
  return (AI_CREDENTIAL_KINDS as readonly string[]).includes(kind);
}

function context(userId: string, kind: CredentialKind) {
  return `credential:${userId}:${kind}`;
}

export async function saveCredential<K extends CredentialKind>(db: TenantDb, userId: string, kind: K, secret: SecretFor<K>) {
  const isKite = kind === "KITE_APP";
  const kite = secret as KiteAppSecret;
  const data = {
    secretEncrypted: encryptJson(secret, context(userId, kind)),
    // The Kite api_key appears in every login URL, so it is not secret; showing it helps users match apps.
    publicId: isKite ? kite.apiKey : null,
    hint: secretHint(isKite ? kite.apiSecret : secret.apiKey),
    lastVerifiedAt: new Date(),
  };
  return db.credential.upsert({
    where: { userId_kind: { userId, kind } },
    update: data,
    create: { userId, kind, ...data },
    select: { kind: true, hint: true, publicId: true, lastVerifiedAt: true, updatedAt: true },
  });
}

/** Decrypts a stored secret. Re-encrypts it under the current key after an APP_SECRET rotation. */
export async function readCredential<K extends CredentialKind>(db: TenantDb, userId: string, kind: K): Promise<SecretFor<K> | null> {
  const row = await db.credential.findUnique({ where: { userId_kind: { userId, kind } } });
  if (!row) return null;
  const secret = decryptJson<SecretFor<K>>(row.secretEncrypted, context(userId, kind));
  if (isStaleCiphertext(row.secretEncrypted)) {
    await db.credential.update({
      where: { id: row.id },
      data: { secretEncrypted: encryptJson(secret, context(userId, kind)) },
    });
  }
  return secret;
}

export async function deleteCredential(db: TenantDb, userId: string, kind: CredentialKind) {
  await db.credential.deleteMany({ where: { userId, kind } });
}

/** Safe to send to the browser: no secrets, only hints. */
export async function listCredentials(db: TenantDb) {
  return db.credential.findMany({
    select: { kind: true, hint: true, publicId: true, lastVerifiedAt: true, updatedAt: true },
    orderBy: { kind: "asc" },
  });
}
