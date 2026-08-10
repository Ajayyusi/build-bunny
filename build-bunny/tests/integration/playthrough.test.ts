import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import { createStudent } from "@/modules/auth/server/provisioning";
import type { SessionContext } from "@/modules/auth/server/session";
import { commitImport } from "@/modules/curriculum/server/import";
import { publishLevel, transitionStatus } from "@/modules/curriculum/server/publish";
import { recomputeUnlocks } from "@/modules/learning/server/adventure";
import { submitAttempt, type AttemptResponse } from "@/modules/grading/server/submit";
import { verifyCertificate } from "@/modules/certificates/server/verify";
import { XP_BY_DIFFICULTY } from "@/modules/curriculum/schemas";
import { bundle } from "../../content";
import { ACHIEVEMENTS } from "../../prisma/seed-data/achievements";

import { createTestSchool, createCtx, enableProgramForSchool, SYSTEM_ACTOR, wipeDatabase } from "../helpers/fixtures";

/**
 * The playthrough: every shipped level, solved for real.
 *
 * This is the test that answers "do the games actually work?". For each
 * published level it takes the level's OWN authored solution and submits it
 * through the real attempt pipeline — the same code path a child's browser
 * hits — then asserts the level was winnable, scored full marks, paid the XP
 * the content promised, and opened the next step of the adventure.
 *
 * A level that cannot be beaten by its own recorded solution is a broken
 * level, and this suite is what stops one from shipping.
 */

let ctx: SessionContext;
let studentUserId: string;
let programId: string;

interface PlayableLevel {
  id: string;
  slug: string;
  worldSlug: string;
  worldName: string;
  order: number;
  activityType: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  xpReward: number | null;
  maxStars: number;
  payload: Record<string, unknown>;
}

let levels: PlayableLevel[] = [];

/** The submission body a real client would send for this activity type. */
function solutionFor(level: PlayableLevel): Record<string, unknown> {
  const payload = level.payload;
  switch (level.activityType) {
    case "BLOCK_CODING":
    case "DEBUGGING": {
      const solution = payload.solution;
      if (!solution) throw new Error(`${level.slug}: no recorded solution in payload`);
      return { workspaceJson: solution };
    }
    case "CODE_PREDICTION": {
      const optionId = payload.correctOptionId;
      if (typeof optionId !== "string") throw new Error(`${level.slug}: no correctOptionId`);
      return { answer: { optionId } };
    }
    case "SEQUENCING": {
      const order = payload.correctOrder;
      if (!Array.isArray(order)) throw new Error(`${level.slug}: no correctOrder`);
      return { answer: { order } };
    }
    default:
      throw new Error(`${level.slug}: no solution strategy for ${level.activityType}`);
  }
}

/**
 * What a full-marks first pass should pay: the level's own award, plus the
 * one-off star-tier bonuses from the XP economy (2nd star +10, 3rd star +10).
 */
function expectedXp(level: PlayableLevel, stars: number): number {
  const base = level.xpReward ?? XP_BY_DIFFICULTY[level.difficulty];
  const starBonus = (stars >= 2 ? STAR_BONUS : 0) + (stars >= 3 ? STAR_BONUS : 0);
  return base + starBonus;
}

const STAR_BONUS = 10;

beforeAll(async () => {
  await wipeDatabase();

  // Import and publish the REAL shipped curriculum through the real pipeline.
  await commitImport(SYSTEM_ACTOR, bundle);
  const program = await db.program.findFirstOrThrow({ where: { slug: "foundations" } });
  programId = program.id;
  await transitionStatus(SYSTEM_ACTOR, "program", programId, "PUBLISHED");

  const worlds = await db.world.findMany({ select: { id: true, horizon: true } });
  for (const world of worlds) {
    await transitionStatus(SYSTEM_ACTOR, "world", world.id, "PUBLISHED");
  }
  const draftLevels = await db.level.findMany({ select: { id: true } });
  for (const level of draftLevels) {
    await publishLevel(SYSTEM_ACTOR, level.id);
  }

  // Badge definitions live in the seed fixture, not the content bundle — a
  // playthrough should earn real badges, so load the shipped definitions.
  for (const def of ACHIEVEMENTS) {
    await db.achievement.create({
      data: {
        slug: def.slug,
        name: def.name,
        description: def.description,
        icon: def.icon,
        criteria: def.criteria as object,
        order: def.order,
      },
    });
  }

  const school = await createTestSchool("Play");
  await enableProgramForSchool(school.id, programId);

  const student = await createStudent(SYSTEM_ACTOR, {
    schoolId: school.id,
    schoolCode: school.code,
    username: "player",
    displayName: "Play Through",
    studentIdentifier: "PT-001",
    grade: 3,
  });
  studentUserId = student.userId;
  await db.studentProfile.update({
    where: { userId: studentUserId },
    data: { programId },
  });
  ctx = createCtx({ userId: studentUserId, role: "STUDENT", schoolId: school.id });

  const published = await db.level.findMany({
    where: { status: "PUBLISHED" },
    select: {
      id: true,
      slug: true,
      order: true,
      activityType: true,
      difficulty: true,
      xpReward: true,
      maxStars: true,
      payload: true,
      module: {
        select: {
          order: true,
          world: {
            select: {
              slug: true,
              name: true,
              horizon: true,
              programs: { select: { order: true } },
            },
          },
        },
      },
    },
  });

  levels = published
    .filter((l) => !l.module.world.horizon)
    .map((l) => ({
      id: l.id,
      slug: l.slug,
      worldSlug: l.module.world.slug,
      worldName: (l.module.world.name as { en: string }).en,
      // Sort key: world position, then module, then level order.
      order:
        (l.module.world.programs[0]?.order ?? 0) * 10_000 + l.module.order * 100 + l.order,
      activityType: l.activityType,
      difficulty: l.difficulty,
      xpReward: l.xpReward,
      maxStars: l.maxStars,
      payload: l.payload as Record<string, unknown>,
    }))
    .sort((a, b) => a.order - b.order);

  await recomputeUnlocks(studentUserId);
}, 180_000);

describe("playthrough — every shipped level is winnable by its own solution", () => {
  it("ships the expected curriculum", () => {
    expect(levels.length).toBeGreaterThanOrEqual(17);
    const worlds = [...new Set(levels.map((l) => l.worldSlug))];
    expect(worlds).toEqual(["bunny-meadow", "logic-forest", "robot-lab"]);
  });

  it("plays all levels in order: each is unlocked, solvable, fully scored, and opens the next", async () => {
    const results: {
      slug: string;
      world: string;
      verdict: string;
      stars: number;
      xp: number;
    }[] = [];
    const certificates: { world: string; serial: string; verifySlug: string }[] = [];
    let runningXp = 0;
    let runningStars = 0;

    for (const level of levels) {
      // The level must be open before it can be played — this is the unlock
      // chain being exercised, not assumed.
      const progress = await db.studentProgress.findUnique({
        where: { studentUserId_levelId: { studentUserId, levelId: level.id } },
      });
      expect(
        progress,
        `${level.worldSlug}/${level.slug} was never unlocked — the progression is broken`,
      ).not.toBeNull();

      const outcome = await submitAttempt(ctx, level.id, {
        attemptRunId: randomUUID(),
        ...solutionFor(level),
        durationMs: 5_000,
      } as Parameters<typeof submitAttempt>[2]);

      expect(
        outcome.status,
        `${level.worldSlug}/${level.slug} submission was rejected`,
      ).toBe(200);
      const body = outcome.body as AttemptResponse;

      expect(
        body.verdict,
        `${level.worldSlug}/${level.slug} is NOT winnable by its own recorded solution`,
      ).toBe("PASS");
      expect(
        body.stars,
        `${level.worldSlug}/${level.slug} scored ${body.stars}/${level.maxStars} on the author's own solution — the star budget is unreachable`,
      ).toBe(level.maxStars);

      runningXp += expectedXp(level, body.stars);
      runningStars += level.maxStars;
      expect(
        body.xpTotal,
        `${level.slug}: XP ledger drifted from the content's promised award`,
      ).toBe(runningXp);

      if (body.certificate && body.worldCompleted) {
        certificates.push({
          world: body.worldCompleted.slug,
          serial: body.certificate.serial,
          verifySlug: body.certificate.verifySlug,
        });
      }

      results.push({
        slug: level.slug,
        world: level.worldSlug,
        verdict: body.verdict,
        stars: body.stars,
        xp: body.xpAwarded,
      });

      await recomputeUnlocks(studentUserId);
    }

    // A readable record of the run — this table is the artifact a human reads
    // when a level regresses.
    console.log(
      "\n" +
        results
          .map(
            (r) =>
              `  ${r.world.padEnd(13)} ${r.slug.padEnd(18)} ${r.verdict} ${r.stars}★ +${r.xp}xp`,
          )
          .join("\n"),
    );

    expect(results.every((r) => r.verdict === "PASS")).toBe(true);

    const profile = await db.studentProfile.findUniqueOrThrow({
      where: { userId: studentUserId },
    });
    expect(profile.xpTotal).toBe(runningXp);
    expect(profile.starsTotal).toBe(runningStars);

    // Finishing every world must produce a verifiable certificate per world.
    expect(certificates.length).toBe(3);
    for (const cert of certificates) {
      const publicView = await verifyCertificate(cert.verifySlug);
      expect(publicView, `certificate ${cert.serial} does not verify`).not.toBeNull();
      expect(publicView!.valid).toBe(true);
      expect(publicView!.revoked).toBe(false);
    }
  }, 300_000);

  it("leaves every level COMPLETED with full stars", async () => {
    const progress = await db.studentProgress.findMany({
      where: { studentUserId },
      select: { status: true, stars: true, level: { select: { slug: true } } },
    });
    const incomplete = progress.filter((p) => p.status !== "COMPLETED");
    expect(
      incomplete.map((p) => p.level.slug),
      "levels left incomplete after a full playthrough",
    ).toEqual([]);
    expect(progress.length).toBeGreaterThanOrEqual(levels.length);
  });

  it("awards the achievements a full playthrough should earn", async () => {
    const earned = await db.studentAchievement.findMany({
      where: { studentUserId },
      select: { achievement: { select: { slug: true } } },
    });
    const slugs = earned.map((e) => e.achievement.slug);
    // These are the badges whose criteria a complete run must satisfy; the
    // rest depend on content that ships in later phases.
    expect(slugs).toContain("first-program");
    expect(slugs).toContain("loop-master");
    expect(slugs).toContain("bug-hunter");
  });
});
