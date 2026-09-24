import { config } from "dotenv";
import { mkdir, open } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const databaseDirectory = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(databaseDirectory, "../.env") });
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl?.startsWith("file:")) {
  throw new Error("DATABASE_URL must be a SQLite file URL before running migrations.");
}
const rawPath = decodeURIComponent(databaseUrl.slice("file:".length).split("?")[0] ?? "");
if (!rawPath || rawPath === ":memory:") process.exit(0);
const databasePath = isAbsolute(rawPath) ? rawPath : resolve(databaseDirectory, rawPath);
await mkdir(dirname(databasePath), { recursive: true });
const databaseFile = await open(databasePath, "a");
await databaseFile.close();
