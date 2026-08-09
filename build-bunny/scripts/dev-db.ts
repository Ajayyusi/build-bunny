/**
 * Project-local PostgreSQL 16 for development & tests (no Docker required).
 *
 * Usage:  npm run db:dev        (keeps running; Ctrl+C to stop)
 *
 * Data persists in .pgdata/. Creates bunny_dev + bunny_test on first run.
 * When Docker is available you can use `docker compose up -d` instead — both
 * expose the same postgresql://bunny:bunny@localhost:5432 endpoints.
 */
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
  });

  if (!existsSync(DATA_DIR)) {
    console.log("[dev-db] initialising cluster in .pgdata ...");
    await pg.initialise();
  }

  console.log("[dev-db] starting PostgreSQL 16 on :5432 ...");
  await pg.start();

  for (const db of ["bunny_dev", "bunny_test"]) {
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
