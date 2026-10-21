import "@testing-library/jest-dom/vitest";

// Test-only values. They are long enough to pass the same validation as production.
process.env.APP_SECRET ??= "unit-test-secret-unit-test-secret-0123456789";
process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/endurance_test";
process.env.APP_URL ??= "http://localhost:3000";
