import "dotenv/config";

import Module from "node:module";
import path from "node:path";

/**
 * Content import CLI: `npx tsx scripts/import-content.ts` dry-runs the
 * bundled content (content/index.ts) against DATABASE_URL and prints the
 * diff; pass `--commit` to apply it through the same import service the
 * platform wizard uses, and `--publish` (which implies --commit) to also
 * bring every non-horizon world live. Idempotent — a re-run of identical
 * content reports everything unchanged and writes nothing.
 *
 * This is the content half of a release. Deploying code does NOT ship
 * curriculum: levels live in the database, and a deploy that skips this step
 * leaves production serving whatever content it was last given.
 */

// ── Runtime shim (same technique as prisma/seed.ts) ───────────────────────
// The "server-only" marker only exists inside the Next.js runtime; map it to
// an inert stand-in BEFORE any src module loads — hence dynamic imports.
const moduleInternals = Module as unknown as {
  _resolveFilename: (request: string, ...rest: unknown[]) => string;
};
const originalResolve = moduleInternals._resolveFilename;
moduleInternals._resolveFilename = function (request: string, ...rest: unknown[]) {
  if (request === "server-only") {
    return path.join(__dirname, "..", "prisma", "seed-data", "server-only-shim.cjs");
  }
  return originalResolve.call(this, request, ...rest);
};

function printGroup(label: string, entries: string[]): void {
  console.log(`\n${label} (${entries.length})`);
  if (entries.length === 0) {
    console.log("  (none)");
    return;
  }
  for (const entry of entries) console.log(`  - ${entry}`);
}

/**
 * `--ci` is the deploy-time mode, used by the `vercel-build` hook so a push
 * ships content as well as code. It differs from a hand-run in two ways
 * that both matter on a build machine:
 *
 *  - It only acts on a PRODUCTION Vercel build. Preview deploys share the
 *    production DATABASE_URL, and a preview branch quietly publishing its
 *    half-finished content to the live curriculum would be a nasty way to
 *    find that out.
 *  - It never fails the build. Content and code are separate concerns; a
 *    database hiccup or a level that fails its gates must not stop a code
 *    fix from shipping. It shouts in the build log instead.
 */
const CI_MODE = process.argv.includes("--ci");

/** Non-zero exit, unless we are inside a build (see --ci). */
function markFailed(): void {
  process.exitCode = CI_MODE ? 0 : 1;
}

function ciShouldRun(): boolean {
  const env = process.env.VERCEL_ENV;
  if (env === undefined) {
    console.log("--ci: not a Vercel build (VERCEL_ENV unset) — skipping content sync.");
    return false;
  }
  if (env !== "production") {
    console.log(`--ci: VERCEL_ENV is "${env}", not production — skipping content sync.`);
    return false;
  }
  return true;
}

async function main(): Promise<void> {
  if (CI_MODE && !ciShouldRun()) return;

  const publish = process.argv.includes("--publish") || CI_MODE;
  // Publishing what you did not import makes no sense, so --publish implies
  // --commit rather than silently doing nothing.
  const commit = process.argv.includes("--commit") || publish;

  const { bundle } = await import("../content");
  const { dryRunImport, commitImport } = await import(
    "../src/modules/curriculum/server/import"
  );
  const { db } = await import("../src/lib/db");

  console.log(
    `Import content bundle: ${bundle.worlds.length} worlds, ${bundle.programs.length} programs`,
  );

  console.log("\n=== Dry run ===");
  const dryRun = await dryRunImport(bundle);
  printGroup("Creates", dryRun.creates);
  printGroup("Updates", dryRun.updates);
  printGroup("Unchanged", dryRun.unchanged);
  printGroup("Issues", dryRun.issues);

  if (dryRun.issues.length > 0) {
    markFailed();
    if (commit) {
      console.error("\nRefusing to commit: the dry run reported issues.");
      await db.$disconnect();
      return;
    }
  }

  if (!commit) {
    console.log("\nDry run only — re-run with --commit to apply.");
    await db.$disconnect();
    return;
  }

  console.log("\n=== Commit ===");
  const result = await commitImport({ userId: "system", role: "SYSTEM" }, bundle);
  printGroup("Created", result.creates);
  printGroup("Updated", result.updates);
  printGroup("Unchanged", result.unchanged);
  printGroup("Issues", result.issues);
  if (result.issues.length > 0) markFailed();

  console.log(
    `\nDone: ${result.creates.length} created, ${result.updates.length} updated, ` +
      `${result.unchanged.length} unchanged, ${result.issues.length} issue(s).`,
  );

  if (!publish) {
    console.log(
      "\nImported content is DRAFT. Students see published levels only —\n" +
        "re-run with --publish, or publish per world in /nitaq/curriculum.",
    );
    await db.$disconnect();
    return;
  }

  // Importing without publishing is the trap this flag exists to close: a
  // release that imports but never publishes leaves production serving the
  // OLD curriculum while the repo looks up to date.
  console.log("\n=== Publish ===");
  const { publishWorld } = await import("../src/modules/curriculum/server/publish");
  const worlds = await db.world.findMany({
    where: { horizon: false },
    select: { id: true, slug: true },
    orderBy: { slug: "asc" },
  });

  let publishedLevels = 0;
  for (const world of worlds) {
    const outcome = await publishWorld({ userId: "system", role: "SYSTEM" }, world.id);
    if (!outcome.ok) {
      console.error(`  ✗ ${world.slug}: ${outcome.issues.join("; ") || "publish gates failed"}`);
      for (const level of outcome.levels.filter((l) => !l.ok)) {
        console.error(`      level "${level.slug}" failed its gates`);
      }
      markFailed();
      continue;
    }
    publishedLevels += outcome.levels.length;
    console.log(`  ✓ ${world.slug}: ${outcome.levels.length} level(s) published`);
  }

  const live = await db.level.count({
    where: { status: "PUBLISHED", publishedVersionId: { not: null } },
  });
  console.log(`\nPublished ${publishedLevels} level(s). ${live} now live.`);
  await db.$disconnect();
}

main().catch((err) => {
  console.error("\nImport failed:", err);
  // In a build, a content failure is loud but never fatal — see --ci above.
  process.exitCode = CI_MODE ? 0 : 1;
});
