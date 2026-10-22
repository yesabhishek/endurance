import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { readJson, removeJson, writeJson } from "./store";

describe("local JSON store", () => {
  let dir: string;
  beforeAll(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "endurance-store-"));
    vi.stubEnv("DATA_DIR", dir);
    vi.stubEnv("ENDURANCE_DEMO", "");
  });
  afterAll(async () => {
    vi.unstubAllEnvs();
    await rm(dir, { recursive: true, force: true });
  });

  it("round-trips JSON in files only the owner can read", async () => {
    await writeJson("chats/abc12345.json", { hello: "world" });
    expect(await readJson("chats/abc12345.json")).toEqual({ hello: "world" });
    const mode = (await stat(path.join(dir, "chats/abc12345.json"))).mode & 0o777;
    expect(mode).toBe(0o600);
    expect(JSON.parse(await readFile(path.join(dir, "chats/abc12345.json"), "utf8"))).toEqual({ hello: "world" });
    await removeJson("chats/abc12345.json");
    expect(await readJson("chats/abc12345.json")).toBeNull();
  });

  it("refuses names that could escape the data folder", async () => {
    await expect(writeJson("../escape.json", {})).rejects.toThrow("Invalid");
    await expect(writeJson("/etc/passwd", {})).rejects.toThrow("Invalid");
    await expect(readJson("chats/../../x.json")).rejects.toThrow("Invalid");
  });
});
