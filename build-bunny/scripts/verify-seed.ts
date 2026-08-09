import "dotenv/config";

import Module from "node:module";
import path from "node:path";

/**
 * Seed verification CLI: `npx tsx scripts/verify-seed.ts` proves the demo
 * database is in the coherent M2 state the seed promises — published levels
 * with version snapshots, per-level progress behind every profile cache, and
 * at least one certificate candidate whose xpTotal equals the real sum of the
 * levels they completed. Read-only; exits 1 on any failed check.
 */

// ── Runtime shim (same technique as prisma/seed.ts) ───────────────────────
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

interface CheckRow {
  Check: string;
  Expected: string;
  Actual: string;
  Result: "ok" | "FAIL";
}

async function main(): Promise<void> {
  const { db } = await import("../src/lib/db");
  const { XP_BY_DIFFICULTY } = await import("../src/modules/curriculum/schemas");

  const rows: CheckRow[] = [];
  const check = (label: string, expected: string, actual: string, ok: boolean): void => {
    rows.push({ Check: label, Expected: expected, Actual: actual, Result: ok ? "ok" : "FAIL" });
  };

  const publishedLevels = await db.level.findMany({
    where: { status: "PUBLISHED", publishedVersionId: { not: null } },
    select: { id: true, slug: true, xpReward: true, difficulty: true },
  });
  check("published levels (with snapshot id)", "10", String(publishedLevels.length),
    publishedLevels.length === 10);

  const versionCount = await db.levelVersion.count();
  check("LevelVersion snapshots", "≥ 10", String(versionCount), versionCount >= 10);

  const progressRows = await db.studentProgress.count();
  check("StudentProgress rows", "> 40", String(progressRows), progressRows > 40);

  // Certificate candidate: at least one student with every published level
  // COMPLETED, whose cached xp/stars equal the sums over their real rows.
  const grouped = await db.studentProgress.groupBy({
    by: ["studentUserId"],
    where: { status: "COMPLETED" },
    _count: { _all: true },
  });
  const finishers = grouped
    .filter((g) => g._count._all === publishedLevels.length)
    .map((g) => g.studentUserId);
  check("students with all levels COMPLETED", "≥ 1", String(finishers.length),
    finishers.length >= 1);

  const xpByLevel = new Map(
    publishedLevels.map((l) => [l.id, l.xpReward ?? XP_BY_DIFFICULTY[l.difficulty]]),
  );
  for (const userId of finishers) {
    const [profile, completions] = await Promise.all([
      db.studentProfile.findUnique({
        where: { userId },
        select: { xpTotal: true, starsTotal: true, user: { select: { username: true } } },
      }),
      db.studentProgress.findMany({
        where: { studentUserId: userId, status: "COMPLETED" },
        select: { levelId: true, stars: true },
      }),
    ]);
    const who = profile?.user.username ?? userId;
    const xpSum = completions.reduce((sum, c) => sum + (xpByLevel.get(c.levelId) ?? 0), 0);
    const starsSum = completions.reduce((sum, c) => sum + c.stars, 0);
    check(`xpTotal of finisher ${who}`, String(xpSum), String(profile?.xpTotal ?? -1),
      profile?.xpTotal === xpSum);
    check(`starsTotal of finisher ${who}`, String(starsSum), String(profile?.starsTotal ?? -1),
      profile?.starsTotal === starsSum);
  }

  console.table(rows);
  const failures = rows.filter((r) => r.Result === "FAIL");
  if (failures.length > 0) {
    console.error(`\n${failures.length} check(s) FAILED.`);
    process.exitCode = 1;
  } else {
    console.log(`\nAll ${rows.length} checks passed.`);
  }
  await db.$disconnect();
}

main().catch((err) => {
  console.error("\nVerification failed:", err);
  process.exitCode = 1;
});
