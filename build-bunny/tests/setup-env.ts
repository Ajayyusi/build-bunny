import "dotenv/config";

/**
 * Runs before any test file (and therefore before any `@/lib` module) is
 * imported. Repoints every DB consumer — Prisma client, Better Auth adapter,
 * env validation — at the dedicated test database so a suite can never wipe
 * or mutate dev data.
 */
const testDatabaseUrl = process.env.TEST_DATABASE_URL;

if (!testDatabaseUrl) {
  throw new Error(
    "TEST_DATABASE_URL is not set. Refusing to run tests: they would " +
      "execute against DATABASE_URL (the dev database) and wipe it. " +
      "Add TEST_DATABASE_URL to .env (see .env for the expected shape).",
  );
}

process.env.DATABASE_URL = testDatabaseUrl;
