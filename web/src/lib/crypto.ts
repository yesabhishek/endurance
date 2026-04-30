import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;

function getKey() {
  const secret = process.env.APP_ENCRYPTION_KEY;
  if (!secret) {
    throw new Error("APP_ENCRYPTION_KEY is required for token encryption.");
  }

  return createHash("sha256").update(secret).digest();
}

export function encryptSecret(value: string | null | undefined) {
  if (!value) return null;

  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [iv, authTag, encrypted].map((part) => part.toString("base64url")).join(".");
}

export function decryptSecret(value: string | null | undefined) {
  if (!value) return null;

  const [ivRaw, authTagRaw, encryptedRaw] = value.split(".");
  if (!ivRaw || !authTagRaw || !encryptedRaw) {
    throw new Error("Encrypted value is malformed.");
  }

  const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivRaw, "base64url"));
  decipher.setAuthTag(Buffer.from(authTagRaw, "base64url"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedRaw, "base64url")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}
