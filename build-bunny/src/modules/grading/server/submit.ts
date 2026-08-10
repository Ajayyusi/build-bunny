import "server-only";

import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { recordLearningEvent } from "@/lib/events";
import { computeStars, ENGINE_VERSION } from "@/engine";
import { getActivityEngine } from "@/modules/activities/server/registry";
import type { ActivityGradeResult } from "@/modules/activities/types";
import type { SessionContext } from "@/modules/auth/server/session";
import { recomputeUnlocks } from "@/modules/learning/server/adventure";
import {
  localizedText,
  XP_BY_DIFFICULTY,
  type LocalizedText,
} from "@/modules/curriculum/schemas";
import { getPublishedLevelSnapshot } from "@/modules/curriculum/server/queries";
import { issueWorldCertificate } from "@/modules/certificates/server/issue";
import { evaluateAchievements, type NewAchievement } from "./achievements";
import { applyDailyActivity } from "./streak";

/**
 * The authoritative attempt pipeline (m3/m4 contract): grade → idempotent
 * reward transaction → unlocks → events → pinned response shape. The HTTP
 * route is a thin adapter (session, body validation, rate limit) around
 * submitAttempt so the whole pipeline is testable with a hand-built
 * SessionContext. Grading itself is dispatched through the activity-engine
 * registry (src/modules/activities) — this file never assumes a grid.
 */

/** Grid types (BLOCK_CODING/DEBUGGING) submit the raw Blockly workspace. */
export interface GridAttemptInput {
  attemptRunId: string;
  workspaceJson: unknown;
  clientVerdict?: "PASS" | "PARTIAL" | "FAIL";
  durationMs?: number;
}

/** Non-grid types submit a small structured answer instead. */
export interface AnswerAttemptInput {
  attemptRunId: string;
  answer: { optionId: string } | { order: string[] } | { blockType: string };
}

export type AttemptInput = GridAttemptInput | AnswerAttemptInput;

function isGridAttemptInput(input: AttemptInput): input is GridAttemptInput {
  return "workspaceJson" in input;
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
  /** Set only on the run that completes a world AND issues (or already holds) its certificate. */
  certificate: { serial: string; verifySlug: string } | null;
  feedback: { code: string; data?: Record<string, unknown> } | null;
  gradeMismatch: boolean;
}

export type SubmitOutcome =
  | { status: 200; body: AttemptResponse }
  | { status: 400 | 403 | 409; body: { error: string } };

/** Injectable clock so streak tests can simulate calendar days. */
export interface SubmitOptions {
  now?: Date;
}

/**
 * The level's own star budget. Snapshots predating the field (or a hand-built
 * test snapshot) fall back to the platform's 3-star scale, so an absent value
 * never silently zeroes a puzzle's reward.
 */
function maxStarsOf(snapshot: { maxStars?: unknown }): number {
  return typeof snapshot.maxStars === "number" && Number.isFinite(snapshot.maxStars)
    ? snapshot.maxStars
    : 3;
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
  grade: ActivityGradeResult,
  response?: AttemptResponse,
): Prisma.InputJsonValue {
  return JSON.parse(
    JSON.stringify({
      // Grid engines contribute perVariant here; CODE_PREDICTION/SEQUENCING
      // contribute their own small audit detail (optionId/order + correct).
      ...grade.summary,
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

  // ── Body shape must match the level's own activity type — the attempts
  // route already validates this per type with Zod; this is the pipeline's
  // own belt-and-suspenders check for any caller that reaches submitAttempt
  // directly (tests, or a future non-HTTP caller). ────────────────────────
  const activityType = published.snapshot.activityType;
  const isGridType = activityType === "BLOCK_CODING" || activityType === "DEBUGGING";
  if (isGridAttemptInput(input) !== isGridType) {
    return { status: 400, body: { error: "VALIDATION" } };
  }

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
        certificate: null,
        feedback: null,
        gradeMismatch: false,
      },
    };
  }

  // ── Authoritative grade against the pinned published snapshot, dispatched
  // through the activity-engine registry (grid workspaceJson or a
  // CODE_PREDICTION/SEQUENCING answer — never assumed here). ──────────────
  const engine = getActivityEngine(activityType);
  if (!engine) {
    // Publish gates only allow V1_ACTIVITY_TYPES to go live, so this means
    // the content/registry drifted apart — an infrastructure bug, not
    // anything the student did. Let the route's catch-all report it.
    throw new Error(`No activity engine registered for type ${activityType}`);
  }
  const gradeInput: unknown = isGridAttemptInput(input) ? input.workspaceJson : input.answer;
  const clientVerdict = isGridAttemptInput(input) ? input.clientVerdict : undefined;
  const durationMs = isGridAttemptInput(input) ? input.durationMs : undefined;

  const grade = engine.grade(published.snapshot, gradeInput);
  const hintAgg = await db.hintUsage.aggregate({
    where: { studentUserId: ctx.userId, schoolId, levelId },
    _max: { tier: true },
  });
  const hintTierUsed = hintAgg._max.tier ?? 0;
  // Clamped to the level's own star budget: the 0/1/2/3 scale and the hint
  // cap stay exactly as they were for puzzles (maxStars 3 makes this a
  // no-op), while a level that declares fewer stars can never award more than
  // it advertises. This is what makes a Learn step (maxStars 0) reward XP but
  // no stars, with computeStars and the star criteria untouched.
  const stars = Math.min(
    computeStars(grade.verdict, grade.qualityPassed, hintTierUsed),
    maxStarsOf(published.snapshot),
  );
  const gradeMismatch = clientVerdict !== undefined && clientVerdict !== grade.verdict;

  const attemptBase = {
    attemptRunId: input.attemptRunId,
    schoolId,
    studentUserId: ctx.userId,
    levelId,
    levelVersion: published.version,
    engineVersion: ENGINE_VERSION,
    // "Inputs, not frames": the grid workspace JSON or the small structured
    // answer object, whichever the level's engine graded.
    workspaceJson: JSON.parse(
      JSON.stringify(gradeInput ?? {}),
    ) as Prisma.InputJsonValue,
    generatedCode: grade.generatedCode,
    verdict: grade.verdict,
    starsEarned: stars,
    durationMs: durationMs ?? null,
    blockCount: grade.blockCount,
    hintTierUsed,
    clientVerdict: clientVerdict ?? null,
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
      certificate: null,
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
    // Optimistic total from the priorXp snapshot above — corrected below to
    // whatever actually lands, since that snapshot can be stale by the time
    // of insert (see the per-row loop's comment).
    const optimisticXpAwarded = awards.reduce((sum, a) => sum + a.amount, 0);

    const attempt = await tx.activityAttempt.create({
      data: {
        ...attemptBase,
        kind: "NORMAL",
        viaImpersonation: false,
        xpAwarded: optimisticXpAwarded,
        resultSummary: summaryJson(grade),
      },
      select: { id: true },
    });

    // One row at a time, not createMany: a genuinely concurrent SECOND
    // attempt by the same student on the same level (two tabs, a fast
    // double Run, or exactly what a classroom load test produces) can read
    // the SAME priorXp snapshot above before either transaction commits —
    // READ COMMITTED does not block that read. createMany would then throw
    // P2002 on the (studentUserId, levelId, source) unique and fail the
    // whole request with a 500 (found via scripts/load-check.ts, m5 task 6:
    // 13/40 concurrent submissions from the same 8 students errored this
    // way). Inserting per-row and catching P2002 turns the loser of that
    // race into a harmless no-op instead of a crash, and — critically —
    // xpAwarded below is corrected to what ACTUALLY landed, so the
    // student's xpTotal cache (incremented further down) can never drift
    // ahead of the ledger it's derived from.
    let xpAwarded = 0;
    for (const award of awards) {
      try {
        await tx.xpEvent.create({
          data: {
            schoolId,
            studentUserId: ctx.userId,
            levelId,
            source: award.source,
            amount: award.amount,
            attemptId: attempt.id,
          },
        });
        xpAwarded += award.amount;
      } catch (err) {
        if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== "P2002") {
          throw err;
        }
        // Lost the race for this specific award — a concurrent attempt
        // already holds it. Not an error: exactly one attempt should win.
      }
    }
    if (xpAwarded !== optimisticXpAwarded) {
      await tx.activityAttempt.update({
        where: { id: attempt.id },
        data: { xpAwarded },
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

  // ── Certificate issuance (m4-contracts): only on the run that just
  // completed a world. Issuance re-derives its own eligibility (genuine
  // full-PASS, not just PARTIAL-completion) and is idempotent by design —
  // a failure here must never break the grading response, only skip the
  // certificate chip for this run (a later completion detection, or the
  // seed/admin tooling, can still issue it). ──────────────────────────────
  let certificate: { serial: string; verifySlug: string } | null = null;
  if (txResult.worldCompleted) {
    try {
      const issued = await issueWorldCertificate({
        schoolId,
        studentUserId: ctx.userId,
        worldId: txResult.worldCompleted.id,
      });
      if (issued.certificate) {
        certificate = { serial: issued.certificate.serial, verifySlug: issued.certificate.verifySlug };
      }
    } catch (err) {
      console.error("[certificates] issuance failed", err);
    }
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
    certificate,
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
