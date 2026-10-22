import { randomBytes } from "node:crypto";
import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { dataDir } from "./config";

// Tiny JSON file store under DATA_DIR. Writes go to a temp file and are renamed
// into place, so a crash never leaves half a file. Files are readable only by you.

const NAME = /^[a-z0-9][a-z0-9._-]*(\/[a-z0-9][a-z0-9._-]*)?$/i;

function resolve(name: string) {
  if (!NAME.test(name) || name.includes("..")) throw new Error(`Invalid data file name: ${name}`);
  const root = dataDir();
  const file = path.resolve(/*turbopackIgnore: true*/ root, name);
  if (!file.startsWith(root + path.sep)) throw new Error(`Invalid data file name: ${name}`);
  return file;
}

export async function readJson<T>(name: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(resolve(name), "utf8")) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    if (error instanceof SyntaxError) {
      console.warn(`[store] ${name} is not valid JSON; ignoring it.`);
      return null;
    }
    throw error;
  }
}

export async function writeJson(name: string, value: unknown) {
  const file = resolve(name);
  await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  const temp = `${file}.${randomBytes(4).toString("hex")}.tmp`;
  await writeFile(temp, JSON.stringify(value), { mode: 0o600 });
  await rename(temp, file);
}

export async function removeJson(name: string) {
  await rm(resolve(name), { force: true });
}

export async function listJson(folder: string) {
  try {
    const entries = await readdir(resolve(folder));
    return entries.filter((entry) => entry.endsWith(".json")).map((entry) => `${folder}/${entry}`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}
