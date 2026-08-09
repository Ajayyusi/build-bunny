import "dotenv/config";

import Module from "node:module";
import path from "node:path";

/**
 * Content import CLI: `npx tsx scripts/import-content.ts` dry-runs the
 * bundled content (content/index.ts) against DATABASE_URL and prints the
 * diff; pass `--commit` to apply it through the same import service the
 * platform wizard uses. Idempotent — a re-run of identical content reports
 * everything unchanged and writes nothing.
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

async function main(): Promise<void> {
  const commit = process.argv.includes("--commit");

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
    process.exitCode = 1;
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
  if (result.issues.length > 0) process.exitCode = 1;

  console.log(
    `\nDone: ${result.creates.length} created, ${result.updates.length} updated, ` +
      `${result.unchanged.length} unchanged, ${result.issues.length} issue(s).`,
  );
  await db.$disconnect();
}

main().catch((err) => {
  console.error("\nImport failed:", err);
  process.exitCode = 1;
});
