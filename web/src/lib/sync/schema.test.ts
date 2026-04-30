import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("sync cursor schema", () => {
  it("exists in both Prisma schema and manual SQLite initializer", () => {
    const root = process.cwd();
    const prismaSchema = readFileSync(path.join(root, "prisma/schema.prisma"), "utf8");
    const initScript = readFileSync(path.join(root, "scripts/init-db.mjs"), "utf8");

    expect(prismaSchema).toContain("model SyncCursor");
    expect(prismaSchema).toContain("@@unique([source, connectedAccountId])");
    expect(initScript).toContain('CREATE TABLE IF NOT EXISTS "SyncCursor"');
    expect(initScript).toContain('"lastHistoryId" TEXT');
  });
});
