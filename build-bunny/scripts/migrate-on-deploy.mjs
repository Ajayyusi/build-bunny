// Apply pending database migrations as the first step of a PRODUCTION
// Vercel build (the `vercel-build` hook runs this before anything else).
//
// Why here: the production database credentials are Vercel "sensitive"
// variables — readable by a build, by no person or tool outside one — so the
// build is the one place that can migrate without a human copying secrets.
//
// Rules:
//  - Production builds only. Preview builds share the production
//    DATABASE_URL, and an unmerged branch must never change the live schema.
//  - Uses the DIRECT (unpooled) connection: migrations take an advisory lock,
//    which a pooled (pgbouncer) connection cannot hold.
//  - A failed migration fails the build, so the new code never goes live
//    against a schema it does not match; the site keeps the previous deploy.
//  - Migrations must stay additive (new tables/columns) so the version still
//    serving traffic keeps working while the new one builds.
import { spawnSync } from "node:child_process";

const env = process.env.VERCEL_ENV;
if (env !== "production") {
  console.log(`migrate-on-deploy: VERCEL_ENV is "${env ?? "unset"}", not production — skipping migrations.`);
  process.exit(0);
}

const direct =
  process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL;
if (!direct) {
  console.error("migrate-on-deploy: no database URL in the build environment — failing the build.");
  process.exit(1);
}

console.log("migrate-on-deploy: applying pending migrations (production)…");
const options = { stdio: "inherit", env: { ...process.env, DATABASE_URL: direct } };
// npx is a .cmd shim on Windows (local runs need a shell); Vercel builds on
// Linux. The command is a fixed string either way — nothing user-supplied.
const result =
  process.platform === "win32"
    ? spawnSync("npx prisma migrate deploy", { ...options, shell: true })
    : spawnSync("npx", ["prisma", "migrate", "deploy"], options);
if (result.error) console.error("migrate-on-deploy: could not start prisma:", result.error.message);
if (result.status !== 0) {
  console.error("migrate-on-deploy: migrations failed — failing the build so the live site keeps the previous deploy.");
  process.exit(result.status ?? 1);
}
console.log("migrate-on-deploy: database is up to date.");
