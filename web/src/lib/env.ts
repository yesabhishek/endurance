import { z } from "zod";

const PLACEHOLDER_PATTERN = /replace|change[-_ ]?me|your[-_ ]|example|placeholder/i;

const secretSchema = z
  .string()
  .min(32, "must be at least 32 characters; run `npm run setup` to generate one")
  .refine((value) => !PLACEHOLDER_PATTERN.test(value), "still holds the placeholder value from .env.example");

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1, "is required"),
  APP_SECRET: secretSchema,
  APP_SECRET_PREVIOUS: secretSchema.optional(),
  APP_URL: z.string().url().default("http://localhost:3000"),
  ALLOWED_HOSTS: z.string().optional(),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  ALLOW_SIGNUP: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  TRUST_PROXY: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GMAIL_SYNC_MONTHS: z.coerce.number().int().positive().default(48),
  GMAIL_SYNC_LIMIT: z.coerce.number().int().positive().default(500),
});

export type AppEnv = z.infer<typeof envSchema>;

let cached: AppEnv | null = null;

/** Validated configuration. Throws a readable error naming every bad variable. */
export function getEnv(): AppEnv {
  if (cached) return cached;

  const raw = { ...process.env };
  // Older installs used APP_ENCRYPTION_KEY; accept it so existing .env files keep working.
  if (!raw.APP_SECRET && raw.APP_ENCRYPTION_KEY) raw.APP_SECRET = raw.APP_ENCRYPTION_KEY;
  for (const key of Object.keys(raw)) {
    if (raw[key] === "") delete raw[key];
  }

  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((issue) => `  ${issue.path.join(".")}: ${issue.message}`).join("\n");
    throw new Error(`Endurance configuration is invalid:\n${problems}`);
  }

  cached = parsed.data;
  return cached;
}

export function appUrl() {
  return new URL(getEnv().APP_URL);
}

export function isHttps() {
  return appUrl().protocol === "https:";
}

export function gmailConfigured() {
  const env = getEnv();
  const real = (value: string | undefined) => Boolean(value && !PLACEHOLDER_PATTERN.test(value));
  return real(env.GOOGLE_CLIENT_ID) && real(env.GOOGLE_CLIENT_SECRET);
}

/** Test hook: forget cached configuration after changing process.env. */
export function resetEnvCache() {
  cached = null;
}
