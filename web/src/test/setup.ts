import "@testing-library/jest-dom/vitest";

process.env.APP_ENCRYPTION_KEY ??= "test-encryption-key";
process.env.DATABASE_URL ??= "file:./test.db";
