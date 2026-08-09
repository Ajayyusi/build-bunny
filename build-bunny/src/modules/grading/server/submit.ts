import "server-only";

import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { recordLearningEvent } from "@/lib/events";
import { computeStars, ENGINE_VERSION } from "@/engine";
import type { SessionContext } from "@/modules/auth/server/session";
import { recomputeUnlocks } from "@/modules/learning/server/adventure";
import {
  localizedText,
  XP_BY_DIFFICULTY,
  type LocalizedText,
} from "@/modules/curriculum/schemas";
import { getPublishedLevelSnapshot } from "@/modules/curriculum/server/queries";
import { evaluateAchievements, type NewAchievement } from "./achievements";
import { gradeWorkspace, type GradeOutcome } from "./grade";
import { applyDailyActivity } from "./streak";

/**
 * The authoritative attempt pipeline (m3 contract): grade → idempotent reward
 * transaction → unlocks → events → pinned response shape. The HTTP route is a
 * thin adapter (session, body validation, rate limit) around submitAttempt so
 * the whole pipeline is testable with a hand-built SessionContext.
 */

export interface AttemptInput {
  attemptRunId: string;
  workspaceJson: unknown;
  clientVerdict?: "PASS" | "PARTIAL" | "FAIL";
  durationMs?: number;
}

export interface AttemptResponse {
  verdict: "PASS" | "PARTIAL" | "FAIL" | "ERROR";
  /** Stars earned by THIS run (post hint-cap). */
  stars: number;
  /** High-water stars on the level after this run. */
  starsBest: number;
  xpAwarded: number;
  xpTotal: number;
  newAchievements: NewAchievement[];
  unlockedLevelIds: string[];
  worldCompleted: { slug: string; name: LocalizedText } | null;
  feedback: { code: string; data?: Record<string, unknown> } | null;
  gradeMismatch: boolean;
}

export type SubmitOutcome =
  | { status: 200; body: AttemptResponse }
  | { status: 403 | 409; body: { error: string } };

/** Injectable clock so streak tests can simulate calendar days. */
export interface SubmitOptions {
  now?: Date;
}

function xpRewardOf(snapshot: { xpReward?: unknown; difficulty?: unknown }): number {
  if (typeof snapshot.xpReward === "number" && Number.isFinite(snapshot.xpReward)) {
    return snapshot.xpReward;
  }
  const difficulty = snapshot.difficulty;
  if (difficulty === "MEDIUM" || difficulty === "HARD" || difficulty === "EASY") {
    return XP_BY_DIFFICULTY[difficulty];
  }
  return XP_BY_DIFFICULTY.EASY;
}

/** The response is stored inside resultSummary for verbatim idempotent replay. */
function storedResponseOf(resultSummary: Prisma.JsonValue): AttemptResponse | null {
  if (!resultSummary || typeof resultSummary !== "object" || Array.isArray(resultSummary)) {
    return null;
  }
  const response = (resultSummary as Record<string, unknown>)["response"];
  if (!response || typeof response !== "object" || Array.isArray(response)) return null;
  return response as unknown as AttemptResponse;
}

function summaryJson(
  grade: GradeOutcome,
  response?: AttemptResponse,
): Prisma.InputJsonValue {
  return JSON.parse(
    JSON.stringify({
      perVariant: grade.perVariant,
      primaryFeedback: grade.primaryFeedback,
      qualityPassed: grade.qualityPassed,
      ...(response ? { response } : {}),
    }),
  ) as Prisma.InputJsonValue;
}

export async function submitAttempt(
  ctx: SessionContext,
  levelId: string,
  input: AttemptInput,
  options: SubmitOptions = {},
): Promise<SubmitOutcome> {
  const schoolId = ctx.schoolId;
  if (!schoolId) return { status: 403, body: { error: "FORBIDDEN" } };
  const now = options.now ?? new Date();

  // ── Published + unlocked (absence of a progress row = LOCKED) ──────────
  const progress = await db.studentProgress.findFirst({
    where: { studentUserId: ctx.userId, schoolId, levelId },
    select: { id: true, status: true, stars: true },
  });
  if (!progress) return { status: 403, body: { error: "LOCKED" } };
  const published = await getPublishedLevelSnapshot(levelId);
  if (!published) return { status: 403, body: { error: "LOCKED" } };

  // ── Idempotency: a replayed attemptRunId returns the stored response ───
  const existing = await db.activityAttempt.findUnique({
    where: { attemptRunId: input.attemptRunId },
    select: { studentUserId: true, resultSummary: true, verdict: true, starsEarned: true },
  });
  if (existing) {
    if (existing.studentUserId !== ctx.userId) {
      return { status: 409, body: { error: "CONFLICT" } };
    }
    const stored = storedResponseOf(existing.resultSummary);
    if (stored) return { status: 200, body: stored };
    // Degenerate: the attempt committed but the pipeline crashed before the
    // response was stored. Rebuild a conservative response — no re-award.
    const [profile, freshProgress] = await Promise.all([
      db.studentProfile.findFirst({
        where: { userId: ctx.userId, schoolId },
        select: { xpTotal: true },
      }),
      db.studentProgress.findFirst({
        where: { studentUserId: ctx.userId, schoolId, levelId },
        select: { stars: true },
      }),
    ]);
    return {
      status: 200,
      body: {
        verdict: existing.verdict,
        stars: existing.starsEarned,
        starsBest: freshProgress?.stars ?? 0,
        xpAwarded: 0,
        xpTotal: profile?.xpTotal ?? 0,
        newAchievements: [],
        unlockedLevelIds: [],
        worldCompleted: null,
        feedback: null,
        gradeMismatch: false,
      },
    };
  }

  // ── Authoritative grade against the pinned published snapshot ──────────
  const grade = gradeWorkspace(published.snapshot, input.workspaceJson);
  const hintAgg = await db.hintUsage.aggregate({
    where: { studentUserId: ctx.userId, schoolId, levelId },
    _max: { tier: true },
  });
  const hintTierUsed = hintAgg._max.tier ?? 0;
  const stars = computeStars(grade.verdict, grade.qualityPassed, hintTierUsed);
  const gradeMismatch =
    input.clientVerdict !== undefined && input.clientVerdict !== grade.verdict;

  const attemptBase = {
    attemptRunId: input.attemptRunId,
    schoolId,
    studentUserId: ctx.userId,
    levelId,
    levelVersion: published.version,
    engineVersion: ENGINE_VERSION,
    workspaceJson: JSON.parse(
      JSON.stringify(input.workspaceJson ?? {}),
    ) as Prisma.InputJsonValue,
    generatedCode: grade.generatedCode,
    verdict: grade.verdict,
    starsEarned: stars,
    durationMs: input.durationMs ?? null,
    blockCount: grade.blockStats.totalBlocks,
    hintTierUsed,
    clientVerdict: input.clientVerdict ?? null,
    gradeMismatch,
  };

  // ── PREVIEW short-circuit: impersonated sessions record the attempt row
  // only — no progress, XP, streak, achievements, unlocks or events. ──────
  if (ctx.impersonatedBy) {
    const profile = await db.studentProfile.findFirst({
      where: { userId: ctx.userId, schoolId },
      select: { xpTotal: true },
    });
    const response: AttemptResponse = {
      verdict: grade.verdict,
      stars,
      starsBest: progress.stars,
      xpAwarded: 0,
      xpTotal: profile?.xpTotal ?? 0,
      newAchievements: [],
      unlockedLevelIds: [],
      worldCompleted: null,
      feedback: grade.primaryFeedback,
      gradeMismatch,
    };
    await db.activityAttempt.create({
      data: {
        ...attemptBase,
        kind: "PREVIEW",
        viaImpersonation: true,
        xpAwarded: 0,
        resultSummary: summaryJson(grade, response),
      },
    });
    return { status: 200, body: response };
  }

  // Progress level ids BEFORE the run — the post-recompute diff yields the
  // newly-unlocked levels for the response.
  const beforeIds = new Set(
    (
      await db.studentProgress.findMany({
        where: { studentUserId: ctx.userId, schoolId },
        select: { levelId: true },
      })
    ).map((row) => row.levelId),
  );

  const school = await db.school.findUnique({
    where: { id: schoolId },
    select: { timezone: true, weekStructure: true },
  });

  const completed = grade.verdict === "PASS" || grade.verdict === "PARTIAL";
  const firstCompletion = completed && progress.status !== "COMPLETED";
  const starsBest = Math.max(progress.stars, stars);
  const starsDelta = Math.max(0, stars - progress.stars);

  // ── The idempotent reward transaction ──────────────────────────────────
  const txResult = await db.$transaction(async (tx) => {
    // XP ledger: the (student, level, source) unique makes every award
    // first-time-only; replayed runIds never reach here at all.
    const priorXp = await tx.xpEvent.findMany({
      where: { studentUserId: ctx.userId, levelId, source: { in: ["LEVEL_PASS", "STAR_2", "STAR_3"] } },
      select: { source: true },
    });
    const priorSources = new Set(priorXp.map((e) => e.source));
    const awards: { source: string; amount: number }[] = [];
    if (completed && !priorSources.has("LEVEL_PASS")) {
      awards.push({ source: "LEVEL_PASS", amount: xpRewardOf(published.snapshot) });
    }
    if (stars >= 2 && !priorSources.has("STAR_2")) {
      awards.push({ source: "STAR_2", amount: 10 });
    }
    if (stars >= 3 && !priorSources.has("STAR_3")) {
      awards.push({ source: "STAR_3", amount: 10 });
    }
    const xpAwarded = awards.reduce((sum, a) => sum + a.amount, 0);

    const attempt = await tx.activityAttempt.create({
      data: {
        ...attemptBase,
        kind: "NORMAL",
        viaImpersonation: false,
        xpAwarded,
        resultSummary: summaryJson(grade),
      },
      select: { id: true },
    });

    if (awards.length > 0) {
      await tx.xpEvent.createMany({
        data: awards.map((award) => ({
          schoolId,
          studentUserId: ctx.userId,
          levelId,
          source: award.source,
          amount: award.amount,
          attemptId: attempt.id,
        })),
      });
    }

    // Progress: high-water stars, never downgrade status.
    await tx.studentProgress.update({
      where: { id: progress.id },
      data: {
        status: completed
          ? "COMPLETED"
          : progress.status === "UNLOCKED"
            ? "IN_PROGRESS"
            : progress.status,
        stars: starsBest,
        attemptsCount: { increment: 1 },
        lastActivityAt: now,
        ...(firstCompletion ? { firstCompletedAt: now } : {}),
        ...(completed ? { completedVersion: published.version } : {}),
        // Draft cleared only on full PASS — a PARTIAL learner keeps their
        // work to try for the missing star.
        ...(grade.verdict === "PASS"
          ? { draftWorkspace: Prisma.DbNull, draftSavedAt: null }
          : {}),
      },
    });

    if (xpAwarded > 0 || starsDelta > 0) {
      await tx.studentProfile.updateMany({
        where: { userId: ctx.userId, schoolId },
        data: {
          xpTotal: { increment: xpAwarded },
          starsTotal: { increment: starsDelta },
        },
      });
    }

    const streak = await applyDailyActivity(tx, {
      studentUserId: ctx.userId,
      schoolId,
      timeZone: school?.timezone ?? "Asia/Dubai",
      weekStructure: school?.weekStructure ?? null,
      now,
      runsDelta: 1,
      completionsDelta: firstCompletion ? 1 : 0,
      xpDelta: xpAwarded,
    });

    // World completion: only a run that just completed a level can complete
    // a world. Checked inside the tx so it sees this run's progress row.
    let worldCompleted: { id: string; slug: string; name: LocalizedText } | null = null;
    if (firstCompletion) {
      const level = await tx.level.findUnique({
        where: { id: levelId },
        select: {
          module: {
            select: {
              world: { select: { id: true, slug: true, name: true, horizon: true } },
            },
          },
        },
      });
      const world = level?.module.world;
      if (world && !world.horizon) {
        const publishedLevels = await tx.level.findMany({
          where: {
            module: { worldId: world.id },
            status: "PUBLISHED",
            publishedVersionId: { not: null },
          },
          select: { id: true },
        });
        const completedCount = await tx.studentProgress.count({
          where: {
            studentUserId: ctx.userId,
            schoolId,
            status: "COMPLETED",
            levelId: { in: publishedLevels.map((l) => l.id) },
          },
        });
        if (publishedLevels.length > 0 && completedCount === publishedLevels.length) {
          const name = localizedText.safeParse(world.name);
          worldCompleted = {
            id: world.id,
            slug: world.slug,
            name: name.success ? name.data : { en: world.slug },
          };
        }
      }
    }

    const newAchievements = await evaluateAchievements(tx, {
      studentUserId: ctx.userId,
      schoolId,
    });

    const profile = await tx.studentProfile.findFirst({
      where: { userId: ctx.userId, schoolId },
      select: { xpTotal: true },
    });

    return {
      attemptId: attempt.id,
      xpAwarded,
      xpTotal: profile?.xpTotal ?? 0,
      newAchievements,
      worldCompleted,
      streak,
    };
  });

  // ── Unlocks (outside the tx: recomputeUnlocks manages its own writes and
  // is safe to re-run — absence here only delays, never loses, an unlock) ──
  let unlockedLevelIds: string[] = [];
  if (completed) {
    await recomputeUnlocks(ctx.userId);
    const afterRows = await db.studentProgress.findMany({
      where: { studentUserId: ctx.userId, schoolId },
      select: { levelId: true },
    });
    unlockedLevelIds = afterRows
      .map((row) => row.levelId)
      .filter((id) => !beforeIds.has(id));
  }

  const response: AttemptResponse = {
    verdict: grade.verdict,
    stars,
    starsBest,
    xpAwarded: txResult.xpAwarded,
    xpTotal: txResult.xpTotal,
    newAchievements: txResult.newAchievements,
    unlockedLevelIds,
    worldCompleted: txResult.worldCompleted
      ? { slug: txResult.worldCompleted.slug, name: txResult.worldCompleted.name }
      : null,
    feedback: grade.primaryFeedback,
    gradeMismatch,
  };

  // Store the response for verbatim idempotent replay.
  await db.activityAttempt.update({
    where: { id: txResult.attemptId },
    data: { resultSummary: summaryJson(grade, response) },
  });

  // ── Learning events (append-only telemetry; never blocks the response) ──
  const eventBase = { schoolId, studentUserId: ctx.userId, levelId };
  await recordLearningEvent({
    ...eventBase,
    type: "RUN_EXECUTED",
    meta: { verdict: grade.verdict, stars },
  });
  await recordLearningEvent({
    ...eventBase,
    type: completed ? "RUN_SUCCEEDED" : "RUN_FAILED",
    meta: { verdict: grade.verdict },
  });
  if (firstCompletion) {
    await recordLearningEvent({
      ...eventBase,
      type: "LEVEL_COMPLETED",
      meta: { stars, verdict: grade.verdict },
    });
  }
  if (txResult.worldCompleted) {
    await recordLearningEvent({
      ...eventBase,
      type: "WORLD_COMPLETED",
      worldId: txResult.worldCompleted.id,
      meta: { worldSlug: txResult.worldCompleted.slug },
    });
  }
  for (const achievement of txResult.newAchievements) {
    await recordLearningEvent({
      ...eventBase,
      type: "ACHIEVEMENT_EARNED",
      meta: { slug: achievement.slug },
    });
  }

  return { status: 200, body: response };
}
