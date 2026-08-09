import { randomUUID } from "node:crypto";

import type { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import type { SessionContext } from "@/modules/auth/server/session";

/** Actor used when tests provision accounts outside any real session. */
export const SYSTEM_ACTOR = { userId: "system", role: "SYSTEM" } as const;

/**
 * Delete every row in FK-safe order (children before parents). Suites call
 * this in beforeAll so each file starts from a known-empty test database.
 */
export async function wipeDatabase(): Promise<void> {
  // M3 attempts/rewards tables first (children before parents).
  await db.studentAchievement.deleteMany();
  await db.achievement.deleteMany();
  await db.xpEvent.deleteMany();
  await db.hintUsage.deleteMany();
  await db.activityAttempt.deleteMany();
  await db.studentDailyActivity.deleteMany();
  // M2 curriculum/learning tables (children before parents).
  await db.studentProgress.deleteMany();
  await db.levelPrerequisite.deleteMany();
  await db.levelVersion.deleteMany();
  await db.level.deleteMany();
  await db.module.deleteMany();
  await db.programWorld.deleteMany();
  await db.schoolProgram.deleteMany();
  await db.world.deleteMany();
  await db.program.deleteMany();
  await db.learningEvent.deleteMany();
  await db.auditLog.deleteMany();
  await db.classMembership.deleteMany();
  await db.class.deleteMany();
  await db.academicYear.deleteMany();
  await db.licence.deleteMany();
  await db.studentProfile.deleteMany();
  await db.teacherProfile.deleteMany();
  await db.session.deleteMany();
  await db.account.deleteMany();
  await db.verification.deleteMany();
  await db.user.deleteMany();
  await db.school.deleteMany();
}

// Counter + UUID fragment: unique across a run AND across leftover rows from
// an interrupted previous run, while staying alphanumeric (the school code is
// embedded in student usernames, which must satisfy the username validator).
let schoolCounter = 0;

export async function createTestSchool(prefix: string) {
  schoolCounter += 1;
  const unique = `${prefix.toLowerCase()}${schoolCounter}${randomUUID().slice(0, 8)}`;
  return db.school.create({
    data: {
      name: `${prefix} Test School`,
      slug: unique,
      code: unique,
    },
  });
}

// ── M2 curriculum builders (direct prisma writes — the import/publish
// pipeline has its own suite; unlock-engine tests only need the rows) ─────

let slugCounter = 0;

/** Globally unique slug — curriculum slugs are @unique across the database. */
export function uniqueSlug(prefix: string): string {
  slugCounter += 1;
  return `${prefix}-${slugCounter}-${randomUUID().slice(0, 8)}`;
}

export async function createTestProgram(
  opts: { status?: "DRAFT" | "PUBLISHED"; name?: string } = {},
) {
  return db.program.create({
    data: {
      slug: uniqueSlug("prog"),
      name: { en: opts.name ?? "Test Program" },
      gradeMin: 3,
      gradeMax: 7,
      status: opts.status ?? "PUBLISHED",
    },
  });
}

export async function addWorldToProgram(
  programId: string,
  order: number,
  opts: {
    horizon?: boolean;
    status?: "DRAFT" | "PUBLISHED";
    name?: string;
  } = {},
) {
  const world = await db.world.create({
    data: {
      slug: uniqueSlug("world"),
      name: { en: opts.name ?? `Test World ${order}` },
      tagline: { en: "A place to hop around" },
      theme: "meadow",
      status: opts.status ?? "PUBLISHED",
      horizon: opts.horizon ?? false,
    },
  });
  await db.programWorld.create({ data: { programId, worldId: world.id, order } });
  return world;
}

export async function createTestModule(
  worldId: string,
  order: number,
  name = `Test Module ${order}`,
) {
  return db.module.create({
    data: { worldId, slug: uniqueSlug("module"), name: { en: name }, order },
  });
}

/**
 * Level + (when published) a LevelVersion snapshot pinned via
 * publishedVersionId. The snapshot text deliberately DIFFERS from the row's
 * draft fields ("DRAFT ..." prefix) so tests can assert student surfaces read
 * the published snapshot, and it carries SECRET-marked payload/hints so tests
 * can assert answer-bearing content never leaks.
 */
export async function createTestLevel(
  moduleId: string,
  order: number,
  opts: {
    status?: "DRAFT" | "PUBLISHED" | "ARCHIVED";
    title?: string;
    maxStars?: number;
    /** Level ids that must ALL be COMPLETED before this level unlocks. */
    requires?: string[];
    /** Real gradeable payload (grading suite); default keeps the SECRET marker. */
    payload?: Record<string, unknown>;
    activityType?: "BLOCK_CODING" | "DEBUGGING";
    difficulty?: "EASY" | "MEDIUM" | "HARD";
    xpReward?: number;
    tags?: string[];
  } = {},
) {
  const status = opts.status ?? "PUBLISHED";
  const title = opts.title ?? `Level ${order}`;
  const maxStars = opts.maxStars ?? 3;
  const activityType = opts.activityType ?? "BLOCK_CODING";
  const difficulty = opts.difficulty ?? "EASY";
  const tags = opts.tags ?? [];
  const payload = opts.payload ?? { solution: "SECRET_PAYLOAD" };
  // Resolved like the publish pipeline: explicit xpReward or difficulty default.
  const xpReward =
    opts.xpReward ?? { EASY: 50, MEDIUM: 75, HARD: 100 }[difficulty];
  const hints = [1, 2, 3, 4].map((tier) => ({
    tier,
    text: { en: `SECRET_HINT tier ${tier}` },
  }));
  const level = await db.level.create({
    data: {
      moduleId,
      slug: uniqueSlug("level"),
      order,
      activityType,
      title: { en: `DRAFT ${title}` },
      story: { en: "DRAFT story" },
      objective: { en: "DRAFT objective" },
      instructions: { en: "DRAFT instructions" },
      explanation: { en: "DRAFT explanation" },
      difficulty,
      estimatedMinutes: 5,
      maxStars,
      xpReward: opts.xpReward,
      tags,
      payload: payload as Prisma.InputJsonValue,
      hints,
      status: status === "PUBLISHED" ? "DRAFT" : status,
    },
  });
  if (status === "PUBLISHED") {
    const version = await db.levelVersion.create({
      data: {
        levelId: level.id,
        version: 1,
        snapshot: {
          levelId: level.id,
          slug: level.slug,
          order,
          activityType,
          track: "PROGRAMMING",
          title: { en: title },
          story: { en: `${title} story` },
          objective: { en: `${title} objective` },
          instructions: { en: `${title} instructions` },
          explanation: { en: `${title} explanation` },
          difficulty,
          estimatedMinutes: 5,
          maxStars,
          xpReward,
          tags,
          payload,
          hints,
        } as Prisma.InputJsonValue,
      },
    });
    await db.level.update({
      where: { id: level.id },
      data: { status: "PUBLISHED", publishedVersionId: version.id },
    });
  }
  if (opts.requires?.length) {
    await db.levelPrerequisite.createMany({
      data: opts.requires.map((requiresLevelId) => ({
        levelId: level.id,
        requiresLevelId,
      })),
    });
  }
  return level;
}

export async function enableProgramForSchool(schoolId: string, programId: string) {
  return db.schoolProgram.create({ data: { schoolId, programId } });
}

/**
 * Plain SessionContext for calling the tenant-scoped data layer directly —
 * queries trust the ctx they are given, so tests build it by hand instead of
 * going through cookies/headers.
 */
export function createCtx(overrides: Partial<SessionContext>): SessionContext {
  return {
    userId: "test-user",
    role: "SCHOOL_ADMIN",
    schoolId: null,
    displayName: "Test",
    locale: "en",
    avatarId: null,
    mustChangePassword: false,
    impersonatedBy: null,
    sessionId: "test",
    ...overrides,
  };
}
