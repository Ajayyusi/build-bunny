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

/**
 * Create any missing database as UTF8, and shout about existing ones that are
 * not — `pg.createDatabase()` clones template1, so on a cluster that was
 * initialised with the Windows ANSI codepage it would silently produce another
 * WIN1252 database that rejects Arabic content ("byte sequence 0xd8 ... has no
 * equivalent in encoding WIN1252"). template0 is the only template that allows
 * an encoding differing from the cluster default; locale is inherited from it.
 */
async function ensureUtf8Databases(
  pg: EmbeddedPostgres,
  names: string[],
): Promise<void> {
  const client = pg.getPgClient();
  await client.connect();
  try {
    for (const name of names) {
      const existing = await client.query<{ enc: string }>(
        "select pg_encoding_to_char(encoding) as enc from pg_database where datname = $1",
        [name],
      );
      const enc = existing.rows[0]?.enc;

      if (!enc) {
        await client.query(
          `CREATE DATABASE ${client.escapeIdentifier(name)} TEMPLATE template0 ENCODING 'UTF8'`,
        );
        console.log(`[dev-db] created database ${name} (UTF8)`);
      } else if (enc !== "UTF8") {
        console.warn(
          `[dev-db] WARNING: database ${name} is ${enc}, not UTF8 — Arabic content cannot be stored.\n` +
            `[dev-db]   Recreate it (destroys its data): DROP DATABASE ${name}; ` +
            `CREATE DATABASE ${name} TEMPLATE template0 ENCODING 'UTF8';`,
        );
      }
    }
  } finally {
    await client.end();
  }
}

async function main() {
  const pg = new EmbeddedPostgres({
    databaseDir: DATA_DIR,
    user: "bunny",
    password: "bunny",
    port: 5432,
    persistent: true,
    // Windows initdb defaults to the ANSI codepage (WIN1252), which cannot
    // store Arabic curriculum text — force UTF8 for fresh clusters. Existing
    // clusters keep whatever encoding they were initialised with, so
    // ensureUtf8Databases() below creates each database as UTF8 explicitly.
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
  });

  if (!existsSync(DATA_DIR)) {
    console.log("[dev-db] initialising cluster in .pgdata (UTF8) ...");
    await pg.initialise();
  }

  console.log("[dev-db] starting PostgreSQL 16 on :5432 ...");
  await pg.start();

  // Ensure the database named in .env exists too, in case it was renamed.
  const envDb = /localhost:5432\/([a-z0-9_]+)/.exec(
    process.env.DATABASE_URL ?? "",
  )?.[1];
  const wanted = new Set(["bunny_dev", "bunny_test", envDb].filter(Boolean) as string[]);

  await ensureUtf8Databases(pg, [...wanted]);

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
