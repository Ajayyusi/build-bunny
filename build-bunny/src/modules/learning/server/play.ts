import "server-only";

import { Prisma } from "@prisma/client";
import { z } from "zod";

import { db } from "@/lib/db";
import { recordLearningEvent } from "@/lib/events";
import { ConflictError, NotFoundError } from "@/modules/auth/server/guard";
import type { SessionContext } from "@/modules/auth/server/session";
import {
  hintsSchema,
  localizedText,
  type LocalizedText,
} from "@/modules/curriculum/schemas";
import { isLevelEntitled } from "@/modules/curriculum/server/entitlement";
import {
  getPublishedLevelSnapshot,
  stripStudentPayload,
} from "@/modules/curriculum/server/queries";
import { getActivityEngine } from "@/modules/activities/server/registry";
import { computeNextStep, type NextStep, type NextStepState } from "@/modules/hints/server/next-step";
import { getLevelIntro, type LevelIntro } from "./adventure";

/**
 * Level-player data layer (m3 contract): the playable payload query plus the
 * hint/draft/started mutations. The "use server" actions in ./actions.ts are
 * thin withAuth wrappers around the *Core functions here — cores take a
 * SessionContext explicitly so the grading suite can drive them without an
 * HTTP session, and are NEVER exposed to the client directly.
 */

/** Wait a failed attempt OR 60 s before the next hint tier unlocks. */
export const HINT_COOLDOWN_MS = 60_000;

/**
 * "Show me the next step" is recorded as this hint tier: above the authored
 * ladder (1–4), so computeStars' existing tier-3+ rule caps the level at two
 * stars, and a teacher's attempt view can tell it apart from the ladder.
 */
export const NEXT_STEP_TIER = 5;

// ── getPlayableLevel (registered in ./queries.ts tenantScopedQueries) ────

export interface PlayableLevel extends LevelIntro {
  /** Post-completion teaching copy (published snapshot). */
  explanation: LocalizedText | null;
  /** Student-stripped payload — answer-bearing fields removed. */
  payload: unknown;
  /** Autosaved workspace, wins over startWorkspace when present. */
  draftWorkspace: unknown;
  /** When the server draft was saved (ISO), or null — the draft's version. */
  draftSavedAt: string | null;
  /** Author-provided starting workspace from the payload (convenience). */
  startWorkspace: unknown;
  starsBest: number;
  /** Hint tiers this student already revealed (ascending). */
  hintsUsedTiers: number[];
  /** Concept tags from the published snapshot (never answer-bearing). */
  tags: string[];
}

const snapshotExtrasSchema = z.object({
  explanation: localizedText.nullish(),
  payload: z.unknown(),
  /** Concept tags — pick "a similar example" and the Learn step to revisit. */
  tags: z.array(z.string()).default([]),
});

/**
 * Everything the player page needs, or null when the level is locked,
 * unpublished, or outside the student's program (same rules as
 * getLevelIntro — absence of a progress row = LOCKED = null).
 */
export async function getPlayableLevel(
  ctx: SessionContext,
  levelId: string,
): Promise<PlayableLevel | null> {
  // Intro already enforces: published + non-horizon world + in-program +
  // progress row exists + snapshot text parses. Null propagates.
  const intro = await getLevelIntro(ctx, levelId);
  if (!intro || !ctx.schoolId) return null;

  const published = await getPublishedLevelSnapshot(levelId);
  if (!published) return null;
  const extras = snapshotExtrasSchema.safeParse(published.snapshot);
  if (!extras.success) return null;

  const [progressRow, hintRows] = await Promise.all([
    db.studentProgress.findFirst({
      where: { studentUserId: ctx.userId, schoolId: ctx.schoolId, levelId },
      select: { stars: true, draftWorkspace: true, draftSavedAt: true },
    }),
    db.hintUsage.findMany({
      where: { studentUserId: ctx.userId, schoolId: ctx.schoolId, levelId },
      select: { tier: true },
      orderBy: { tier: "asc" },
    }),
  ]);
  if (!progressRow) return null;

  const payload = stripStudentPayload(intro.activityType, extras.data.payload);
  const startWorkspace =
    payload && typeof payload === "object" && !Array.isArray(payload)
      ? ((payload as Record<string, unknown>)["startWorkspace"] ?? null)
      : null;

  return {
    ...intro,
    explanation: extras.data.explanation ?? null,
    payload,
    draftWorkspace: progressRow.draftWorkspace ?? null,
    draftSavedAt: progressRow.draftSavedAt?.toISOString() ?? null,
    startWorkspace,
    starsBest: progressRow.stars,
    hintsUsedTiers: hintRows.map((row) => row.tier),
    tags: extras.data.tags,
  };
}

// ── Mutation cores (wrapped by ./actions.ts) ─────────────────────────────

function requireSchool(ctx: SessionContext): string {
  if (!ctx.schoolId) {
    throw new Error("This operation requires a school-scoped session");
  }
  return ctx.schoolId;
}

/** Progress row of an unlocked level — locked/unknown resolve to NotFound. */
/**
 * The gate every player mutation goes through: hints, draft autosave, and
 * marking a level started.
 *
 * Requires BOTH a progress row and a live entitlement to the content. The
 * row alone used to be enough, which quietly made it authorization — and
 * since assignment creation is what writes those rows, an assignment for
 * content outside the school's programme granted hint and draft access to
 * it. Checking entitlement here covers all three callers at once, so a
 * future fourth cannot forget it.
 */
async function requireProgressRow(
  ctx: SessionContext,
  levelId: string,
): Promise<{ id: string; status: "UNLOCKED" | "IN_PROGRESS" | "COMPLETED" }> {
  const schoolId = requireSchool(ctx);
  const row = await db.studentProgress.findFirst({
    where: { studentUserId: ctx.userId, schoolId, levelId },
    select: { id: true, status: true },
  });
  if (!row) throw new NotFoundError("Level is locked or does not exist");
  if (!(await isLevelEntitled(schoolId, levelId))) {
    // Same error as "locked": a caller probing for content the school does
    // not license learns nothing from the distinction.
    throw new NotFoundError("Level is locked or does not exist");
  }
  return row;
}

export interface RevealedHint {
  tier: number;
  text: LocalizedText;
}

/**
 * Server-held hints (published snapshot — never in student payloads).
 * Tier 1 is free; tier n>1 unlocks only after tier n-1 was revealed AND the
 * student either made a NORMAL attempt since or waited 60 s — hints assist
 * effort, they don't replace it. Re-revealing an already-used tier returns
 * the text again without a new usage row or event.
 */
export async function revealHintCore(
  ctx: SessionContext,
  input: { levelId: string; tier: number },
  now: Date = new Date(),
): Promise<RevealedHint> {
  const schoolId = requireSchool(ctx);
  const { levelId, tier } = input;
  await requireProgressRow(ctx, levelId);

  const published = await getPublishedLevelSnapshot(levelId);
  if (!published) throw new NotFoundError("Level is not published");
  const hints = hintsSchema.safeParse(
    (published.snapshot as { hints?: unknown }).hints,
  );
  if (!hints.success) throw new NotFoundError("Level has no hints");
  const hint = hints.data.find((h) => h.tier === tier);
  if (!hint) throw new NotFoundError(`No tier ${tier} hint`);

  const usages = await db.hintUsage.findMany({
    where: { studentUserId: ctx.userId, schoolId, levelId },
    select: { tier: true, createdAt: true },
  });
  const already = usages.find((u) => u.tier === tier);
  if (already) return { tier, text: hint.text };

  if (tier > 1) {
    const previous = usages.find((u) => u.tier === tier - 1);
    if (!previous) throw new ConflictError("HINT_TIER_ORDER");
    const cooledDown = now.getTime() - previous.createdAt.getTime() >= HINT_COOLDOWN_MS;
    if (!cooledDown) {
      const attemptSince = await db.activityAttempt.findFirst({
        where: {
          studentUserId: ctx.userId,
          schoolId,
          levelId,
          kind: "NORMAL",
          createdAt: { gt: previous.createdAt },
        },
        select: { id: true },
      });
      if (!attemptSince) throw new ConflictError("HINT_LOCKED");
    }
  }

  await db.hintUsage.create({
    data: { schoolId, studentUserId: ctx.userId, levelId, tier },
  });
  await recordLearningEvent({
    type: "HINT_USED",
    schoolId,
    studentUserId: ctx.userId,
    levelId,
    meta: { tier },
  });
  return { tier, text: hint.text };
}

/**
 * "Show me the next step": the one next move that brings the child's
 * current work closer to a pass (see modules/hints/server/next-step.ts).
 * Needs the answer-bearing payload, so it only ever runs here. The first
 * request per level is recorded as hint tier 5; later ones are free — the
 * star cap has already been paid.
 */
export async function nextStepHintCore(
  ctx: SessionContext,
  input: { levelId: string; state: NextStepState },
): Promise<NextStep> {
  const schoolId = requireSchool(ctx);
  const { levelId, state } = input;
  await requireProgressRow(ctx, levelId);
  const published = await getPublishedLevelSnapshot(levelId);
  if (!published) throw new NotFoundError("Level is not published");
  const { snapshot } = published;
  const engine = getActivityEngine(snapshot.activityType);
  if (!engine) throw new NotFoundError("No engine for this level");

  const step = computeNextStep(snapshot.activityType, snapshot.payload, state, (answer) => {
    try {
      const grade = engine.grade(snapshot, answer);
      return { pass: grade.verdict === "PASS", top: grade.verdict === "PASS" && grade.qualityPassed };
    } catch {
      return { pass: false, top: false };
    }
  });

  const existing = await db.hintUsage.findFirst({
    where: { studentUserId: ctx.userId, schoolId, levelId, tier: NEXT_STEP_TIER },
    select: { id: true },
  });
  if (!existing) {
    await db.hintUsage.create({
      data: { schoolId, studentUserId: ctx.userId, levelId, tier: NEXT_STEP_TIER },
    });
    await recordLearningEvent({
      type: "HINT_USED",
      schoolId,
      studentUserId: ctx.userId,
      levelId,
      meta: { tier: NEXT_STEP_TIER, nextStep: true },
    });
  }
  return step;
}

/** Autosave — only when the progress row exists (locked levels save nothing). */
/**
 * A child's biggest real program is a few hundred blocks — tens of KB. The
 * cap stops a script from storing megabytes that every page load would then
 * send back.
 */
export const MAX_DRAFT_BYTES = 200_000;

export async function saveWorkspaceDraftCore(
  ctx: SessionContext,
  input: { levelId: string; workspaceJson: unknown },
): Promise<{ savedAt: Date }> {
  const size = JSON.stringify(input.workspaceJson ?? null).length;
  if (size > MAX_DRAFT_BYTES) throw new ConflictError("Draft is too large");
  const row = await requireProgressRow(ctx, input.levelId);
  const savedAt = new Date();
  await db.studentProgress.update({
    where: { id: row.id },
    data: {
      draftWorkspace:
        input.workspaceJson === null || input.workspaceJson === undefined
          ? Prisma.DbNull
          : (JSON.parse(JSON.stringify(input.workspaceJson)) as Prisma.InputJsonValue),
      draftSavedAt: savedAt,
    },
  });
  return { savedAt };
}

/** UNLOCKED → IN_PROGRESS exactly once; repeat calls are silent no-ops. */
export async function markLevelStartedCore(
  ctx: SessionContext,
  input: { levelId: string },
): Promise<{ started: boolean }> {
  const schoolId = requireSchool(ctx);
  const row = await requireProgressRow(ctx, input.levelId);
  if (row.status !== "UNLOCKED") return { started: false };

  // Guarded update: two concurrent starts race benignly — only the one that
  // actually flips the row records the event.
  const updated = await db.studentProgress.updateMany({
    where: { id: row.id, status: "UNLOCKED" },
    data: { status: "IN_PROGRESS", lastActivityAt: new Date() },
  });
  if (updated.count === 0) return { started: false };

  await recordLearningEvent({
    type: "LEVEL_STARTED",
    schoolId,
    studentUserId: ctx.userId,
    levelId: input.levelId,
  });
  return { started: true };
}

// ── Reflections (brief §6) ─────────────────────────────────────────────────

export type ReflectionFeeling = "EASY" | "JUST_RIGHT" | "TRICKY";

/**
 * "How did that feel?" — one tap after a level, stored once per child per
 * level (tapping again changes it). Only levels the child can reach: the
 * same progress-row + entitlement gate as hints and drafts. No free text.
 */
/**
 * While a platform admin views as a student nothing is recorded as the
 * child's own answer (the same rule submitAttempt follows for progress).
 */
export async function saveReflectionCore(
  ctx: SessionContext,
  input: { levelId: string; feeling: ReflectionFeeling },
): Promise<{ feeling: ReflectionFeeling }> {
  const schoolId = requireSchool(ctx);
  await requireProgressRow(ctx, input.levelId);
  if (ctx.impersonatedBy) return { feeling: input.feeling };
  await db.levelReflection.upsert({
    where: { studentUserId_levelId: { studentUserId: ctx.userId, levelId: input.levelId } },
    create: { schoolId, studentUserId: ctx.userId, levelId: input.levelId, feeling: input.feeling },
    update: { feeling: input.feeling },
  });
  return { feeling: input.feeling };
}
