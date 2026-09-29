import "server-only";
import { z } from "zod";

/*
  Read at request time, not at import, so `next build` needs no secrets.
  On Vercel a database is mandatory: the in-memory store is per-instance,
  so rate limits and the research log would silently fall apart.
*/

const csv = z
  .string()
  .transform((value) => value.split(",").map((item) => item.trim()).filter(Boolean))
  .pipe(z.array(z.string()).min(1));

const Env = z.object({
  GROQ_API_KEY: z.string().min(1, "GROQ_API_KEY is required"),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters"),
  DATABASE_URL: z.url().optional(),
  GAME_MODELS: csv.default(["openai/gpt-oss-20b", "openai/gpt-oss-120b"]),
  GUARD_MODEL: z.string().default("meta-llama/llama-prompt-guard-2-86m"),
  GUARD_THRESHOLD: z.coerce.number().min(0).max(1).default(0.5),
  DAILY_ATTEMPT_CAP: z.coerce.number().int().positive().default(1800),
  IP_HOURLY_LIMIT: z.coerce.number().int().positive().default(40),
  GAME_ENABLED: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
});

export type Config = z.infer<typeof Env>;

let cached: Config | null = null;

export function getConfig(): Config {
  if (cached) return cached;
  const parsed = Env.safeParse(process.env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
    throw new Error(`Invalid environment: ${problems.join("; ")}`);
  }
  if (process.env.VERCEL && !parsed.data.DATABASE_URL) {
    throw new Error("Invalid environment: DATABASE_URL is required on Vercel");
  }
  cached = parsed.data;
  return cached;
}
