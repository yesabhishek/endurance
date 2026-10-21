import { randomBytes, scrypt as scryptCallback, timingSafeEqual, type ScryptOptions } from "node:crypto";

// scrypt parameters follow OWASP's minimum (N=2^17 is preferred on servers with
// spare memory; 2^15 keeps login fast on small self-hosted machines).
const PARAMS = { N: 2 ** 15, r: 8, p: 1 };
const KEY_LENGTH = 64;
const MAX_MEM = 128 * PARAMS.N * PARAMS.r * 2;

export const PASSWORD_MIN_LENGTH = 12;

function scrypt(password: string, salt: Buffer, keyLength: number, options: ScryptOptions) {
  return new Promise<Buffer>((resolve, reject) => {
    scryptCallback(password.normalize("NFKC"), salt, keyLength, options, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, KEY_LENGTH, { ...PARAMS, maxmem: MAX_MEM });
  return ["scrypt", PARAMS.N, PARAMS.r, PARAMS.p, salt.toString("base64url"), key.toString("base64url")].join("$");
}

export async function verifyPassword(password: string, stored: string) {
  const [scheme, n, r, p, saltRaw, keyRaw] = stored.split("$");
  if (scheme !== "scrypt" || !saltRaw || !keyRaw) return false;

  const expected = Buffer.from(keyRaw, "base64url");
  const options = { N: Number(n), r: Number(r), p: Number(p) };
  const actual = await scrypt(password, Buffer.from(saltRaw, "base64url"), expected.length, {
    ...options,
    maxmem: 128 * options.N * options.r * 2,
  });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** Returns a user-facing problem with the password, or null when it is acceptable. */
export function passwordProblem(password: string, email?: string) {
  if (password.length < PASSWORD_MIN_LENGTH) return `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
  if (password.length > 256) return "Use 256 characters or fewer.";
  if (email && password.toLowerCase().includes(email.split("@")[0]?.toLowerCase() ?? "\u0000")) {
    return "Don't include your email name in the password.";
  }
  if (/^(.)\1+$/.test(password)) return "Avoid a single repeated character.";
  return null;
}

// A real hash of a random value, used to keep login timing the same whether or
// not the email exists.
let dummyHash: Promise<string> | null = null;
export function getDummyHash() {
  dummyHash ??= hashPassword(randomBytes(24).toString("base64url"));
  return dummyHash;
}
