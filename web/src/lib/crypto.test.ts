import { afterEach, describe, expect, it } from "vitest";
import { decrypt, encrypt, isStaleCiphertext, resetKeyring, secretHint } from "./crypto";
import { resetEnvCache } from "./env";

const ORIGINAL = { secret: process.env.APP_SECRET, previous: process.env.APP_SECRET_PREVIOUS };

function useSecrets(secret: string, previous?: string) {
  process.env.APP_SECRET = secret;
  if (previous) process.env.APP_SECRET_PREVIOUS = previous;
  else delete process.env.APP_SECRET_PREVIOUS;
  resetEnvCache();
  resetKeyring();
}

afterEach(() => {
  useSecrets(ORIGINAL.secret!, ORIGINAL.previous);
});

describe("encryption", () => {
  it("round-trips and never stores the plaintext", () => {
    const ciphertext = encrypt("sk-live-abc123", "credential:user-1:OPENAI");
    expect(ciphertext).not.toContain("sk-live");
    expect(ciphertext.startsWith("v1.")).toBe(true);
    expect(decrypt(ciphertext, "credential:user-1:OPENAI")).toBe("sk-live-abc123");
  });

  it("refuses a ciphertext moved to another user or purpose", () => {
    const ciphertext = encrypt("secret", "credential:user-1:OPENAI");
    expect(() => decrypt(ciphertext, "credential:user-2:OPENAI")).toThrow();
    expect(() => decrypt(ciphertext, "credential:user-1:ANTHROPIC")).toThrow();
  });

  it("detects tampering", () => {
    const parts = encrypt("secret", "ctx").split(".");
    parts[4] = Buffer.from("tampered").toString("base64url");
    expect(() => decrypt(parts.join("."), "ctx")).toThrow();
  });

  it("keeps old values readable after rotating APP_SECRET", () => {
    const oldSecret = "old-secret-old-secret-old-secret-0123456789";
    const newSecret = "new-secret-new-secret-new-secret-0123456789";
    useSecrets(oldSecret);
    const ciphertext = encrypt("kite-token", "ctx");

    useSecrets(newSecret, oldSecret);
    expect(decrypt(ciphertext, "ctx")).toBe("kite-token");
    expect(isStaleCiphertext(ciphertext)).toBe(true);
    expect(isStaleCiphertext(encrypt("kite-token", "ctx"))).toBe(false);

    useSecrets(newSecret);
    expect(() => decrypt(ciphertext, "ctx")).toThrow(/no longer configured/);
  });

  it("shows at most the last four characters", () => {
    expect(secretHint("sk-ant-api03-abcdefghijklmnop")).toBe("••••mnop");
    expect(secretHint("short")).toBe("••••");
  });
});
