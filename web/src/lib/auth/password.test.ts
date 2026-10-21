import { describe, expect, it } from "vitest";
import { hashPassword, passwordProblem, verifyPassword } from "./password";

describe("passwords", () => {
  it("hashes with a random salt and verifies", async () => {
    const first = await hashPassword("correct horse battery staple");
    const second = await hashPassword("correct horse battery staple");
    expect(first).not.toBe(second);
    expect(first.startsWith("scrypt$")).toBe(true);
    await expect(verifyPassword("correct horse battery staple", first)).resolves.toBe(true);
    await expect(verifyPassword("correct horse battery stapl", first)).resolves.toBe(false);
    await expect(verifyPassword("anything", "not-a-hash")).resolves.toBe(false);
  });

  it("explains weak passwords in plain words", () => {
    expect(passwordProblem("short")).toMatch(/12 characters/);
    expect(passwordProblem("aaaaaaaaaaaaaaa")).toMatch(/repeated/);
    expect(passwordProblem("abhishek-portfolio-2026", "abhishek@example.com")).toMatch(/email/);
    expect(passwordProblem("monsoon tea at four")).toBeNull();
  });
});
