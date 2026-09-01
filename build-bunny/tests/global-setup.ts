import { execSync } from "node:child_process";
import { createConnection } from "node:net";
import "dotenv/config";

import EmbeddedPostgres from "embedded-postgres";

/**
 * Runs once per `vitest` invocation, before any worker starts: makes sure a
 * PostgreSQL is listening, then brings the test database schema up to date.
 * Suites only wipe/seed rows after this; they never touch DDL.
 *
 * If nothing is listening on the configured port, one is started in-process
 * from the `embedded-postgres` package — a real PostgreSQL binary, not a
 * mock. It was already a dependency and nothing used it, while the
 * integration suite could only run where Docker was working. That made the
 * 240-odd database tests unrunnable on any machine with a broken Docker
 * install, which is exactly when you most want to run them.
 *
 * Deliberately binds the SAME port the existing config expects rather than
 * introducing a second URL. That way `.env`, CI and every developer's
 * mental model stay identical, and this is invisible when a real server is
 * already there — including in CI, where the workflow's postgres service
 * answers first and none of this runs.
 */

const PORT = 5432;
const HOST = "127.0.0.1";
const USER = "bunny";
const PASSWORD = "bunny";
/** Both databases the suites expect; `bunny_dev` exists so tooling pointed at DATABASE_URL still connects. */
const DATABASES = ["bunny_test", "bunny_dev"];

function portIsOpen(port: number, host: string, timeoutMs = 1000): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ port, host });
    const done = (open: boolean) => {
      socket.destroy();
      resolve(open);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
  });
}

export default async function globalSetup(): Promise<(() => Promise<void>) | void> {
  const testDatabaseUrl = process.env.TEST_DATABASE_URL;

  if (!testDatabaseUrl) {
    throw new Error(
      "TEST_DATABASE_URL is not set. Refusing to migrate or run tests " +
        "against DATABASE_URL (the dev database).",
    );
  }

  let embedded: EmbeddedPostgres | null = null;

  if (!(await portIsOpen(PORT, HOST))) {
    console.log(`[tests] nothing on ${HOST}:${PORT} — starting embedded PostgreSQL`);
    embedded = new EmbeddedPostgres({
      // Gitignored; wiped and rebuilt whenever it is missing.
      databaseDir: "./.embedded-postgres",
      user: USER,
      password: PASSWORD,
      port: PORT,
      // Not persistent: a suite must never inherit rows from a previous run,
      // and the schema is reapplied by migrate deploy below anyway.
      persistent: false,
      // UTF8 explicitly. initdb otherwise follows the host locale, which on a
      // Windows machine is WIN1252 — and this product stores Arabic level
      // titles and emoji achievement icons, so a WIN1252 cluster fails 12
      // tests with "character ... has no equivalent in encoding WIN1252".
      // The C collation keeps ordering identical across developer machines,
      // so a sort-dependent assertion cannot pass here and fail elsewhere.
      initdbFlags: ["--encoding=UTF8", "--locale=C"],
    });
    await embedded.initialise();
    await embedded.start();

    for (const name of DATABASES) {
      // Idempotent: a re-used data directory already has them.
      await embedded.createDatabase(name).catch(() => undefined);
    }
  }

  execSync("npx prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: testDatabaseUrl },
    stdio: "inherit",
  });

  if (!embedded) return;
  // Vitest awaits this after the last worker exits.
  return async () => {
    await embedded.stop();
  };
}
