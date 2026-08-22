import { z } from "zod";

/**
 * Environment validation (plan §0.1 / security doc §8) — fail fast at boot,
 * never let the app run half-configured. Server-only values stay out of the
 * client bundle; only NEXT_PUBLIC_* is exposed.
 */
/**
 * Better Auth itself wants 32+ characters and warns at boot below that, so
 * 16 was a floor the auth library did not actually accept. Enforced only in
 * production: raising it everywhere would break every existing dev and CI
 * env file for a value that guards nothing outside a deployed environment.
 */
const PRODUCTION_SECRET_MIN = 32;

/**
 * A length check alone passes "aaaaaaaa…". Counting distinct characters is a
 * crude entropy proxy, but it is enough to reject a padded or repeated
 * placeholder, which is the realistic failure — nobody hand-writes a
 * high-length low-entropy secret on purpose.
 */
const MIN_DISTINCT_CHARS = 12;

const serverSchema = z
  .object({
    DATABASE_URL: z.string().url().startsWith("postgresql"),
    BETTER_AUTH_SECRET: z
      .string()
      .min(16, "BETTER_AUTH_SECRET must be at least 16 characters"),
    NEXT_PUBLIC_APP_URL: z.string().url(),
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  })
  .superRefine((value, ctx) => {
    if (value.NODE_ENV !== "production") return;

    if (value.BETTER_AUTH_SECRET.length < PRODUCTION_SECRET_MIN) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["BETTER_AUTH_SECRET"],
        message:
          `must be at least ${PRODUCTION_SECRET_MIN} characters in production ` +
          `(generate one with: openssl rand -base64 32)`,
      });
    }
    if (new Set(value.BETTER_AUTH_SECRET).size < MIN_DISTINCT_CHARS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["BETTER_AUTH_SECRET"],
        message:
          `looks like a placeholder (fewer than ${MIN_DISTINCT_CHARS} distinct ` +
          `characters) — generate one with: openssl rand -base64 32`,
      });
    }
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
