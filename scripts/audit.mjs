#!/usr/bin/env node
// Fails on any high or critical advisory in production dependencies, except the
// reviewed exceptions below. Each exception must say why it is not reachable.
import { execFileSync } from "node:child_process";

const REVIEWED_EXCEPTIONS = {
  // deepmerge-ts stack exhaustion on recursive object graphs. Only the Prisma CLI's
  // config loader uses it, on our own config at migrate time. Fixed in Prisma 7.
  "GHSA-ggr8-5vv4-36mx": "prisma CLI only; upgrade to Prisma 7 to remove",
};

const BLOCKING = new Set(["high", "critical"]);

let report;
try {
  report = execFileSync("npm", ["audit", "--omit=dev", "--json"], { encoding: "utf8" });
} catch (error) {
  // npm audit exits non-zero when it finds anything; the JSON is still on stdout.
  report = error.stdout;
}

const { vulnerabilities = {} } = JSON.parse(report);
const blocking = [];

for (const [name, vulnerability] of Object.entries(vulnerabilities)) {
  for (const via of vulnerability.via) {
    if (typeof via !== "object" || !BLOCKING.has(via.severity)) continue;
    const id = via.url?.split("/").pop();
    if (id && REVIEWED_EXCEPTIONS[id]) continue;
    blocking.push(`${via.severity.padEnd(8)} ${name}: ${via.title} (${via.url})`);
  }
}

if (blocking.length) {
  console.error("Blocking advisories in production dependencies:\n" + blocking.join("\n"));
  process.exit(1);
}

console.log("No unreviewed high or critical advisories in production dependencies.");
