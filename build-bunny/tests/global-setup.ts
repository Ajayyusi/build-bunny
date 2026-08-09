import { execSync } from "node:child_process";
import "dotenv/config";

/**
 * Runs once per `vitest` invocation, before any worker starts: brings the
 * test database schema up to date. Suites then only wipe/seed rows, never
 * touch DDL.
 */
export default function globalSetup(): void {
  const testDatabaseUrl = process.env.TEST_DATABASE_URL;

  if (!testDatabaseUrl) {
    throw new Error(
      "TEST_DATABASE_URL is not set. Refusing to migrate or run tests " +
        "against DATABASE_URL (the dev database).",
    );
  }

  execSync("npx prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: testDatabaseUrl },
    stdio: "inherit",
  });
}
