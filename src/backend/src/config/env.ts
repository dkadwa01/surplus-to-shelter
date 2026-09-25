import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

config({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../../../../.env") });

const EnvironmentSchema = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().int().positive().default(4000),
  FRONTEND_ORIGIN: z.string().url().default("http://localhost:5173"),
  LOCATION_SEARCH_URL: z.string().url().default("https://nominatim.openstreetmap.org/search"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

const parsed = EnvironmentSchema.safeParse(process.env);
if (!parsed.success) {
  throw new Error(`Invalid environment configuration: ${parsed.error.message}`);
}

export const env = parsed.data;
