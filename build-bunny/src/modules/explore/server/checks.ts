import "server-only";

import { db } from "@/lib/db";
import { ConflictError, NotFoundError } from "@/modules/auth/server/guard";
import type { SessionContext } from "@/modules/auth/server/session";

import {
  CONCEPT_CHECKS,
  EXPLORE_FOLLOW_UP,
  EXPLORE_SLUGS,
  type CheckChoice,
  type ExploreConcept,
} from "../catalog";

/**
 * The one-tap "explain it" check after an AI activity. It is asked only once
 * the level is finished, the answer is one of three fixed choices (nothing
 * typed, nothing free-form stored), and the FIRST answer is what a teacher
 * sees: getting there on the third try is still worth knowing, so
 * `correctAt` records that too.
 */

function requireStudentSchool(ctx: SessionContext): string {
  if (ctx.role !== "STUDENT" || !ctx.schoolId) throw new NotFoundError("Level not found");
  return ctx.schoolId;
}

export interface ConceptCheckState {
  concept: ExploreConcept;
  /** Already answered correctly once: the card doesn't ask again. */
  answeredCorrectly: boolean;
}

/**
 * For the play page: is this an Explore AI level (the success card then
 * offers "More AI to explore"), and does it ask the quick check — already
 * answered correctly by this child, or not yet?
 */
export async function getExploreLevelContext(
  ctx: SessionContext,
  levelId: string,
): Promise<{ isExplore: boolean; check: ConceptCheckState | null }> {
  if (ctx.role !== "STUDENT" || !ctx.schoolId) return { isExplore: false, check: null };
  const level = await db.level.findUnique({ where: { id: levelId }, select: { slug: true } });
  if (!level) return { isExplore: false, check: null };
  const isExplore = EXPLORE_SLUGS.has(level.slug) || level.slug === EXPLORE_FOLLOW_UP.slug;
  const check = CONCEPT_CHECKS[level.slug];
  if (!check) return { isExplore, check: null };
  const row = await db.conceptCheck.findUnique({
    where: { studentUserId_levelId: { studentUserId: ctx.userId, levelId } },
    select: { correctAt: true },
  });
  return { isExplore, check: { concept: check.concept, answeredCorrectly: Boolean(row?.correctAt) } };
}

export async function answerConceptCheckCore(
  ctx: SessionContext,
  input: { levelId: string; choice: CheckChoice },
  now = new Date(),
): Promise<{ correct: boolean }> {
  const schoolId = requireStudentSchool(ctx);
  const level = await db.level.findUnique({ where: { id: input.levelId }, select: { slug: true } });
  const check = level ? CONCEPT_CHECKS[level.slug] : undefined;
  if (!check) throw new NotFoundError("Level not found");
  // Asked after finishing — and only for a level this child really finished
  // in their own school, which is also the tenant check.
  const finished = await db.studentProgress.findFirst({
    where: { studentUserId: ctx.userId, schoolId, levelId: input.levelId, status: "COMPLETED" },
    select: { id: true },
  });
  if (!finished) throw new ConflictError("NOT_FINISHED");

  const correct = input.choice === check.correct;
  // Viewing as a student records nothing as the child's own answer.
  if (ctx.impersonatedBy) return { correct };

  const existing = await db.conceptCheck.findUnique({
    where: { studentUserId_levelId: { studentUserId: ctx.userId, levelId: input.levelId } },
    select: { id: true, correctAt: true },
  });
  if (!existing) {
    await db.conceptCheck
      .create({
        data: {
          schoolId,
          studentUserId: ctx.userId,
          levelId: input.levelId,
          firstChoice: input.choice,
          firstCorrect: correct,
          correctAt: correct ? now : null,
        },
      })
      // Two taps racing: the other one already stored the first answer.
      .catch((error: { code?: string }) => {
        if (error?.code !== "P2002") throw error;
      });
  } else if (correct && !existing.correctAt) {
    await db.conceptCheck.update({ where: { id: existing.id }, data: { correctAt: now } });
  }
  return { correct };
}
