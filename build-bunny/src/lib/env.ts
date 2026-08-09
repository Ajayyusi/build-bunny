import { z } from "zod";

/**
 * Environment validation (plan §0.1 / security doc §8) — fail fast at boot,
 * never let the app run half-configured. Server-only values stay out of the
 * client bundle; only NEXT_PUBLIC_* is exposed.
 */
const serverSchema = z.object({
  DATABASE_URL: z.string().url().startsWith("postgresql"),
  BETTER_AUTH_SECRET: z
    .string()
    .min(16, "BETTER_AUTH_SECRET must be at least 16 characters"),
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

function loadEnv() {
  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}

export const env = loadEnv();

export const isProduction = env.NODE_ENV === "production";
