import "dotenv/config";

import { execFileSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

/**
 * Restore the NITAQ Demo School to its canonical mid-journey state.
 *
 * Why this exists: the seed is deliberately non-destructive — it never
 * downgrades a student's progress, because doing so to a real school would
 * erase a child's work. That is correct for production and useless before a
 * sales demo, where the school must look exactly the way the demo script
 * describes. This script is the one place allowed to clear demo learning data.
 *
 * Scope guard: it only ever touches the school whose code is DEMO_SCHOOL_CODE,
 * and it refuses to run against a database that has more than one school
 * unless --force is passed, so it can never be mistaken for a global reset.
 *
 * Usage:  npm run demo:reset
 */

const DEMO_SCHOOL_CODE = "DEMO";

const db = new PrismaClient();

async function main() {
  const force = process.argv.includes("--force");

  const school = await db.school.findUnique({
    where: { code: DEMO_SCHOOL_CODE },
    select: { id: true, name: true },
  });
  if (!school) {
    console.error(`[reset-demo] no school with code ${DEMO_SCHOOL_CODE} — run npm run db:seed first`);
    process.exit(1);
  }

  const schoolCount = await db.school.count();
  if (schoolCount > 1 && !force) {
    console.error(
      `[reset-demo] refusing to run: this database holds ${schoolCount} schools.\n` +
        `[reset-demo] Only "${school.name}" would be reset, but pass --force to confirm you intend that.`,
    );
    process.exit(1);
  }

  const students = await db.user.findMany({
    where: { schoolId: school.id, role: "STUDENT" },
    select: { id: true },
  });
  const studentIds = students.map((s) => s.id);
  console.log(`[reset-demo] resetting ${studentIds.length} students in ${school.name} ...`);

  // Order matters only for readability — every table below is keyed on the
  // student or the school, and none is referenced by the rows that survive
  // (accounts, classes, curriculum).
  const cleared = await db.$transaction([
    db.activityAttempt.deleteMany({ where: { schoolId: school.id } }),
    db.xpEvent.deleteMany({ where: { studentUserId: { in: studentIds } } }),
    db.hintUsage.deleteMany({ where: { studentUserId: { in: studentIds } } }),
    db.studentDailyActivity.deleteMany({ where: { studentUserId: { in: studentIds } } }),
    db.studentAchievement.deleteMany({ where: { studentUserId: { in: studentIds } } }),
    db.teacherFeedback.deleteMany({ where: { schoolId: school.id } }),
    db.certificate.deleteMany({ where: { schoolId: school.id } }),
    db.studentProgress.deleteMany({ where: { schoolId: school.id } }),
    db.learningEvent.deleteMany({ where: { schoolId: school.id } }),
    // Caches back to zero so the seed treats each profile as untouched and
    // re-applies the canonical demo progress.
    db.studentProfile.updateMany({
      where: { schoolId: school.id },
      data: {
        xpTotal: 0,
        starsTotal: 0,
        streakCurrent: 0,
        streakBest: 0,
        lastActiveDate: null,
      },
    }),
  ]);

  const labels = [
    "attempts",
    "xp events",
    "hint usages",
    "daily activity",
    "achievements",
    "feedback",
    "certificates",
    "progress rows",
    "learning events",
    "profiles reset",
  ];
  cleared.forEach((r, i) => console.log(`[reset-demo]   ${labels[i]}: ${r.count}`));

  await db.$disconnect();

  console.log("[reset-demo] replaying the seed to restore canonical progress ...");
  execFileSync("npx", ["tsx", "prisma/seed.ts"], { stdio: "inherit", shell: true });

  console.log("[reset-demo] done — verify with: npx tsx scripts/verify-seed.ts");
}

main().catch(async (err) => {
  console.error("[reset-demo] failed:", err);
  await db.$disconnect();
  process.exit(1);
});
