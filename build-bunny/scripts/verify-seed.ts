import "dotenv/config";

import Module from "node:module";
import path from "node:path";

/**
 * Seed verification CLI: `npx tsx scripts/verify-seed.ts` proves the demo
 * database is in the coherent state the seed promises — 37 published levels
 * (Worlds 1–6, including the m4 CODE_PREDICTION/SEQUENCING levels, the
 * CONCEPT_CARDS Learn steps, and the phase-G graft's 4 AI-concept levels in
 * the two OPEN modules) with version snapshots, per-level progress behind
 * every profile cache, the 12 achievement definitions, the tightened world
 * gate materialized (whoever finished Worlds 1–2 has Robot Lab's first level
 * UNLOCKED), and every OPEN-module level UNLOCKED for every student
 * regardless of coding progress. Read-only; exits 1 on any failed check.
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
    select: {
      id: true,
      slug: true,
      xpReward: true,
      difficulty: true,
      module: { select: { world: { select: { slug: true } } } },
    },
  });
  check("published levels (with snapshot id)", "37", String(publishedLevels.length),
    publishedLevels.length === 37);

  const robotLabLevels = publishedLevels.filter(
    (l) => l.module.world.slug === "robot-lab",
  );
  check("published Robot Lab levels", "7", String(robotLabLevels.length),
    robotLabLevels.length === 7);

  // Phase G graft: the two OPEN concept modules ship 4 levels between them —
  // seeing-and-secrets (ai-island) and lines-in-the-sand (data-desert).
  const GRAFT_SLUGS = [
    "see-like-a-computer",
    "secret-keepers",
    "you-be-the-classifier",
    "fortune-teller",
  ];
  const graftLevels = publishedLevels.filter((l) => GRAFT_SLUGS.includes(l.slug));
  check("published OPEN-module (AI concept) levels", "4", String(graftLevels.length),
    graftLevels.length === 4);

  // Since both graft modules are unlockRule OPEN, every demo student must
  // have all 4 levels open already, regardless of coding-world progress —
  // the entire point of "no coding prerequisite". (UNLOCKED with source
  // OPEN; a student who somehow completed one still counts as open.)
  const demoSchool = await db.school.findUnique({
    where: { code: "DEMO" },
    select: { id: true },
  });
  if (demoSchool && graftLevels.length === 4) {
    const graftIds = graftLevels.map((l) => l.id);
    const students = await db.studentProfile.findMany({
      where: { schoolId: demoSchool.id },
      select: { userId: true, user: { select: { username: true } } },
    });
    let openForAll = true;
    for (const student of students) {
      const openRows = await db.studentProgress.count({
        where: { studentUserId: student.userId, levelId: { in: graftIds } },
      });
      if (openRows !== graftIds.length) {
        openForAll = false;
        check(`OPEN levels open for ${student.user.username}`, "4", String(openRows), false);
      }
    }
    check("OPEN-module levels open for every demo student", "yes",
      openForAll ? "yes" : "no", openForAll);
  }

  const versionCount = await db.levelVersion.count();
  check("LevelVersion snapshots", "≥ 18", String(versionCount), versionCount >= 18);

  const achievementCount = await db.achievement.count();
  check("achievement definitions", "12", String(achievementCount), achievementCount === 12);

  const progressRows = await db.studentProgress.count();
  check("StudentProgress rows", "> 40", String(progressRows), progressRows > 40);

  // Certificate candidates: seeded progress covers Worlds 1–2 — at least one
  // student finished them all, and their cached xp/stars equal the sums over
  // their real progress rows.
  const worldOneTwoIds = publishedLevels
    .filter((l) => ["bunny-meadow", "logic-forest"].includes(l.module.world.slug))
    .map((l) => l.id);
  // Bunny Meadow 6 + Logic Forest 9 = 15: the original 10, plus m4's
  // loop-detective, plus four CONCEPT_CARDS Learn steps (learn-repeat,
  // learn-loop-body, learn-if, learn-repeat-until).
  check("published Worlds 1–2 levels", "15", String(worldOneTwoIds.length),
    worldOneTwoIds.length === 15);

  const grouped = await db.studentProgress.groupBy({
    by: ["studentUserId"],
    where: { status: "COMPLETED", levelId: { in: worldOneTwoIds } },
    _count: { _all: true },
  });
  const finishers = grouped
    .filter((g) => g._count._all === worldOneTwoIds.length)
    .map((g) => g.studentUserId);
  check("students with Worlds 1–2 fully COMPLETED", "≥ 1", String(finishers.length),
    finishers.length >= 1);

  // Tightened world gate, materialized: every Worlds 1–2 finisher must have
  // Robot Lab's first level OPEN — meaning the gate actually lifted. It may
  // be UNLOCKED (just opened by recomputeUnlocks) or already COMPLETED,
  // since the demo's finisher now plays on through Robot Lab so that AI
  // Island is reachable at all. Insisting on UNLOCKED specifically would
  // fail purely because she got further, which is not a gate problem.
  const robotLabFirst = robotLabLevels.find((l) => l.slug === "power-up");
  check("robot-lab/power-up published", "yes", robotLabFirst ? "yes" : "no",
    Boolean(robotLabFirst));
  for (const userId of finishers) {
    const profile = await db.studentProfile.findUnique({
      where: { userId },
      select: { user: { select: { username: true } } },
    });
    const who = profile?.user.username ?? userId;
    const row = robotLabFirst
      ? await db.studentProgress.findUnique({
          where: { studentUserId_levelId: { studentUserId: userId, levelId: robotLabFirst.id } },
          select: { status: true, unlockSource: true },
        })
      : null;
    check(`robot-lab power-up open for finisher ${who}`, "UNLOCKED or COMPLETED",
      row ? `${row.status} (${row.unlockSource})` : "LOCKED (no row)",
      row?.status === "UNLOCKED" || row?.status === "COMPLETED");
  }

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
