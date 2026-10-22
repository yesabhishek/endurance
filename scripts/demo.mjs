#!/usr/bin/env node
// `npm run demo`: starts the app with a sample portfolio so you can look around
// before connecting Kite. Demo chats are kept apart from your real ones.
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const next = createRequire(import.meta.url).resolve("next/dist/bin/next");
const child = spawn(process.execPath, [next, "dev", "-H", "127.0.0.1", ...process.argv.slice(2)], {
  stdio: "inherit",
  env: { ...process.env, ENDURANCE_DEMO: "true" },
});
child.on("exit", (code) => process.exit(code ?? 0));
