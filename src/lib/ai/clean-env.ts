// AI SDK 7 provider packages build a default client when they are imported, and that
// throws if a *_BASE_URL variable is set but empty, as OPENAI_BASE_URL is in .env.example.
// provider.ts imports this module first so the empty ones are gone before that happens.
for (const name of Object.keys(process.env)) {
  if (name.endsWith("_BASE_URL") && !process.env[name]?.trim()) delete process.env[name];
}

export {};
