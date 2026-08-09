/**
 * Project-local PostgreSQL 16 for development & tests (no Docker required).
 *
 * Usage:  npm run db:dev        (keeps running; Ctrl+C to stop)
 *
 * Data persists in .pgdata/. Creates bunny_dev + bunny_test on first run.
 * When Docker is available you can use `docker compose up -d` instead — both
 * expose the same postgresql://bunny:bunny@localhost:5432 endpoints.
 */
import "dotenv/config";
import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const DATA_DIR = resolve(import.meta.dirname, "..", ".pgdata");

async function main() {
  const pg = new EmbeddedPostgres({
    databaseDir: DATA_DIR,
    user: "bunny",
    password: "bunny",
    port: 5432,
    persistent: true,
    // Windows initdb defaults to the ANSI codepage (WIN1252), which cannot
    // store Arabic curriculum text — force UTF8 for fresh clusters. Existing
    // clusters keep their encoding; this machine's workaround is the
    // bunny_dev_utf8 database (.env comment).
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
  });

  if (!existsSync(DATA_DIR)) {
    console.log("[dev-db] initialising cluster in .pgdata (UTF8) ...");
    await pg.initialise();
  }

  console.log("[dev-db] starting PostgreSQL 16 on :5432 ...");
  await pg.start();

  // Ensure the database named in .env exists too (e.g. bunny_dev_utf8).
  const envDb = /localhost:5432\/([a-z0-9_]+)/.exec(
    process.env.DATABASE_URL ?? "",
  )?.[1];
  const wanted = new Set(["bunny_dev", "bunny_test", envDb].filter(Boolean) as string[]);

  for (const db of wanted) {
    try {
      await pg.createDatabase(db);
      console.log(`[dev-db] created database ${db}`);
    } catch {
      // already exists — fine
    }
  }

  console.log("[dev-db] ready: postgresql://bunny:bunny@localhost:5432/bunny_dev");

  const stop = async () => {
    console.log("\n[dev-db] stopping ...");
    await pg.stop();
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  // keep alive
  await new Promise(() => {});
}

main().catch((err) => {
  console.error("[dev-db] failed:", err);
  process.exit(1);
});
