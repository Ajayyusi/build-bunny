import "dotenv/config";

import Module from "node:module";
import path from "node:path";

/**
 * Fast-forward a demo student to a specific level, so a level deep in the
 * trail can be opened by hand without playing everything before it.
 *
 * Why this exists: levels unlock strictly in order, so reaching (say) the
 * Robot Lab Learn step means solving fifteen puzzles first. That is correct
 * product behaviour and a poor use of a reviewer's afternoon.
 *
 * What it does: marks every level ordered before the target as COMPLETED for
 * that student, resets the target itself to UNLOCKED so it opens at its first
 * beat, then runs the REAL recomputeUnlocks — so the resulting state is
 * whatever the unlock engine actually produces, not a hand-forced row.
 *
 * What it is NOT: a way to award progress. It writes COMPLETED rows directly
 * and never runs the grading or reward pipeline, so XP, stars, streaks,
 * badges and certificates will NOT match what a real playthrough would have
 * produced. Use it to reach a screen, never to test rewards.
 *
 * Scope guards, in order of severity:
 *   1. LOCALHOST ONLY. Refuses to run unless DATABASE_URL points at a local
 *      host. There is deliberately no --force: this script fabricates a
 *      child's learning history, and no flag should make that a keystroke
 *      away from a school's real database. Running it elsewhere means
 *      editing this file, which is a decision rather than an accident.
 *   2. Demo school only — the student must belong to DEMO_SCHOOL_CODE.
 *
 * Usage:  npm run dev:skip-to -- <level-slug> [username]
 *         npm run dev:skip-to -- learn-if-else adam
 */

// "server-only" and the request-scoped session module only exist inside the
// Next runtime; map them to the seed's inert stand-ins BEFORE any src module
// loads, which is why the imports below are dynamic. Same trick as
// prisma/seed.ts — see its Runtime shims note.
const seedData = path.join(__dirname, "..", "prisma", "seed-data");
const moduleInternals = Module as unknown as {
  _resolveFilename: (request: string, ...rest: unknown[]) => string;
};
const originalResolve = moduleInternals._resolveFilename;
moduleInternals._resolveFilename = function (request: string, ...rest: unknown[]) {
  if (request === "server-only") return path.join(seedData, "server-only-shim.cjs");
  if (request === "@/modules/auth/server/session")
    return path.join(seedData, "session-shim.cjs");
  return originalResolve.call(this, request, ...rest);
};

const DEMO_SCHOOL_CODE = "DEMO";
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]", "0.0.0.0"]);

/**
 * True only when DATABASE_URL names a loopback host. Anything unparseable is
 * treated as remote: a URL this script cannot read is a URL it must not
 * write to.
 */
function isLocalDatabase(url: string | undefined): boolean {
  if (!url) return false;
  try {
    return LOCAL_HOSTS.has(new URL(url).hostname);
  } catch {
    return false;
  }
}

function usage(message: string): never {
  console.error(`[skip-to] ${message}`);
  console.error("[skip-to] usage: npm run dev:skip-to -- <level-slug> [username]");
  process.exit(1);
}

async function main() {
  const [targetSlug, username = "aisha"] = process.argv.slice(2);
  if (!targetSlug) usage("no level slug given");

  if (!isLocalDatabase(process.env.DATABASE_URL)) {
    console.error(
      "[skip-to] refusing to run: DATABASE_URL does not point at a local database.\n" +
        "[skip-to] This script fabricates a student's learning history and is for\n" +
        "[skip-to] local development only. There is no --force by design.",
    );
    process.exit(1);
  }

  const { db } = await import("../src/lib/db");
  const { recomputeUnlocks } = await import("../src/modules/learning/server/adventure");

  const student = await db.user.findFirst({
    where: {
      displayUsername: username,
      studentProfile: { school: { code: DEMO_SCHOOL_CODE } },
    },
    select: {
      id: true,
      displayName: true,
      studentProfile: { select: { schoolId: true } },
    },
  });
  if (!student?.studentProfile) {
    usage(
      `no student "${username}" in school ${DEMO_SCHOOL_CODE} — run npm run db:seed first`,
    );
  }
  const schoolId = student.studentProfile.schoolId;

  // Trail order is world, then module, then level. World order lives on the
  // ProgramWorld join rather than on World itself.
  const programWorlds = await db.programWorld.findMany({
    select: { worldId: true, order: true },
  });
  const worldOrder = new Map(programWorlds.map((pw) => [pw.worldId, pw.order]));

  const levels = await db.level.findMany({
    select: {
      id: true,
      slug: true,
      order: true,
      maxStars: true,
      module: { select: { order: true, worldId: true } },
    },
  });
  levels.sort(
    (a, b) =>
      (worldOrder.get(a.module.worldId) ?? 0) - (worldOrder.get(b.module.worldId) ?? 0) ||
      a.module.order - b.module.order ||
      a.order - b.order,
  );

  const targetIndex = levels.findIndex((l) => l.slug === targetSlug);
  if (targetIndex < 0) {
    console.error(`[skip-to] no level "${targetSlug}". Available slugs, in trail order:`);
    console.error(levels.map((l) => `  ${l.slug}`).join("\n"));
    process.exit(1);
  }
  const target = levels[targetIndex]!;

  for (const level of levels.slice(0, targetIndex)) {
    await db.studentProgress.upsert({
      where: {
        studentUserId_levelId: { studentUserId: student.id, levelId: level.id },
      },
      create: {
        schoolId,
        studentUserId: student.id,
        levelId: level.id,
        status: "COMPLETED",
        stars: level.maxStars,
        firstCompletedAt: new Date(),
        unlockSource: "SEED",
      },
      update: { status: "COMPLETED", stars: level.maxStars },
    });
  }

  // Reset the target itself so it opens at its first beat rather than
  // resuming mid-attempt from an earlier run of this script.
  await db.studentProgress.updateMany({
    where: { studentUserId: student.id, levelId: target.id },
    data: { status: "UNLOCKED", stars: 0, firstCompletedAt: null },
  });

  await recomputeUnlocks(student.id);

  const row = await db.studentProgress.findFirst({
    where: { studentUserId: student.id, levelId: target.id },
    select: { status: true },
  });
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  console.log(
    `[skip-to] ${student.displayName}: ${targetIndex} level(s) marked COMPLETED`,
  );
  console.log(`[skip-to] ${targetSlug} is now ${row?.status ?? "MISSING"}`);
  console.log(`[skip-to] ${origin}/play/${target.id}`);
  await db.$disconnect();
}

main().catch(async (error) => {
  console.error("[skip-to] failed:", error);
  process.exit(1);
});
