import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes, timingSafeEqual } from "node:crypto";
import { getEnv } from "@/lib/env";

// Ciphertext format: v1.<keyId>.<iv>.<authTag>.<ciphertext>, all base64url.
// The key is derived from APP_SECRET with HKDF; keyId lets APP_SECRET rotate:
// put the old value in APP_SECRET_PREVIOUS and existing ciphertexts still decrypt.
// Every ciphertext is bound to a context string (for example "credential:<userId>:OPENAI")
// through AES-GCM associated data, so a value copied to another row fails to decrypt.

const ALGORITHM = "aes-256-gcm";
const VERSION = "v1";
const IV_BYTES = 12;

type Key = { id: string; bytes: Buffer };

function deriveKey(secret: string): Key {
  const bytes = Buffer.from(hkdfSync("sha256", secret, "endurance", "endurance:encryption:v1", 32));
  const id = createHash("sha256").update(bytes).digest("base64url").slice(0, 10);
  return { id, bytes };
}

let keyring: { current: Key; all: Map<string, Key> } | null = null;

function getKeyring() {
  if (keyring) return keyring;
  const env = getEnv();
  const current = deriveKey(env.APP_SECRET);
  const all = new Map([[current.id, current]]);
  if (env.APP_SECRET_PREVIOUS) {
    const previous = deriveKey(env.APP_SECRET_PREVIOUS);
    all.set(previous.id, previous);
  }
  keyring = { current, all };
  return keyring;
}

export function encrypt(plaintext: string, context: string): string {
  const { current } = getKeyring();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, current.bytes, iv);
  cipher.setAAD(Buffer.from(context, "utf8"));
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, current.id, iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(".");
}

export function decrypt(payload: string, context: string): string {
  const [version, keyId, ivRaw, tagRaw, ciphertextRaw] = payload.split(".");
  if (version !== VERSION || !keyId || !ivRaw || !tagRaw || ciphertextRaw === undefined) {
    throw new Error("Encrypted value has an unknown format.");
  }

  const key = getKeyring().all.get(keyId);
  if (!key) {
    throw new Error("Encrypted value uses a key that is no longer configured. Restore APP_SECRET_PREVIOUS or reconnect.");
  }

  const decipher = createDecipheriv(ALGORITHM, key.bytes, Buffer.from(ivRaw, "base64url"));
  decipher.setAAD(Buffer.from(context, "utf8"));
  decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertextRaw, "base64url")), decipher.final()]).toString("utf8");
}

export function encryptJson(value: unknown, context: string) {
  return encrypt(JSON.stringify(value), context);
}

export function decryptJson<T>(payload: string, context: string): T {
  return JSON.parse(decrypt(payload, context)) as T;
}

/** True when the value was written with a key other than the current one. */
export function isStaleCiphertext(payload: string) {
  return payload.split(".")[1] !== getKeyring().current.id;
}

export function randomToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

export function sha256Hex(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function safeEqual(a: string, b: string) {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  return left.length === right.length && timingSafeEqual(left, right);
}

/** Last four characters for display, never more. */
export function secretHint(secret: string) {
  const trimmed = secret.trim();
  return trimmed.length <= 8 ? "••••" : `••••${trimmed.slice(-4)}`;
}

/** Test hook. */
export function resetKeyring() {
  keyring = null;
}
