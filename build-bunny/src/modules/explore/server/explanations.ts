import "server-only";

import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { NotFoundError } from "@/modules/auth/server/guard";
import type { SessionContext } from "@/modules/auth/server/session";
import { AI_CONCEPTS, type AiConcept } from "@/modules/analytics/ai-concepts";

import { explainConceptFor, isValidSentence } from "../explanations";
import { soundCount } from "./explanations-key";

/**
 * Save the child's "Say it your way" sentence for a level they finished.
 * Phrase ids only; the latest sentence replaces the one before.
 */
export async function saveExplanationCore(
  ctx: SessionContext,
  input: { levelId: string; parts: string[] },
): Promise<{ saved: boolean }> {
  if (ctx.role !== "STUDENT" || !ctx.schoolId) throw new NotFoundError("Not a student");
  const schoolId = ctx.schoolId;
  const level = await db.level.findUnique({ where: { id: input.levelId }, select: { slug: true } });
  const concept = level ? explainConceptFor(level.slug) : null;
  if (!concept || !isValidSentence(concept, input.parts)) throw new NotFoundError("No sentence for this level");
  // Only for a level this child finished, in their own school.
  const finished = await db.studentProgress.findFirst({
    where: { studentUserId: ctx.userId, schoolId, levelId: input.levelId, status: "COMPLETED" },
    select: { id: true },
  });
  if (!finished) throw new NotFoundError("Level not finished");
  // A platform admin viewing as the child leaves nothing behind.
  if (ctx.impersonatedBy) return { saved: false };
  const data = { parts: input.parts, soundParts: soundCount(input.parts) };
  await db.explanationSentence.upsert({
    where: { studentUserId_levelId: { studentUserId: ctx.userId, levelId: input.levelId } },
    update: data,
    create: { schoolId, studentUserId: ctx.userId, levelId: input.levelId, ...data },
  });
  return { saved: true };
}

/**
 * A teacher (for a child in one of their classes) or the school admin ticks
 * "heard them explain it aloud" for one of the five AI concepts — or
 * clears it. Same scope rule as teacher feedback.
 */
export async function setConceptObservedCore(
  ctx: SessionContext,
  input: { studentUserId: string; concept: AiConcept; observed: boolean },
): Promise<{ observed: boolean }> {
  const schoolId = ctx.schoolId;
  if (!schoolId || (ctx.role !== "TEACHER" && ctx.role !== "SCHOOL_ADMIN")) throw new NotFoundError("Not staff");
  if (!(AI_CONCEPTS as readonly string[]).includes(input.concept)) throw new NotFoundError("Unknown concept");
  const student = await db.user.findFirst({
    where: {
      id: input.studentUserId,
      schoolId,
      role: "STUDENT",
      ...(ctx.role === "TEACHER"
        ? {
            classMemberships: {
              some: {
                role: "STUDENT",
                schoolId,
                class: { memberships: { some: { userId: ctx.userId, role: "TEACHER", schoolId } } },
              },
            },
          }
        : {}),
    },
    select: { id: true },
  });
  if (!student) throw new NotFoundError("Student is not in scope for this account");
  if (input.observed) {
    await db.conceptObservation.upsert({
      where: { studentUserId_concept: { studentUserId: student.id, concept: input.concept } },
      update: {},
      create: { schoolId, studentUserId: student.id, concept: input.concept, observedByUserId: ctx.userId },
    });
  } else {
    await db.conceptObservation.deleteMany({ where: { studentUserId: student.id, concept: input.concept } });
  }
  await audit({
    action: "student.concept_observed",
    actorUserId: ctx.userId,
    actorRole: ctx.role,
    schoolId,
    targetType: "student",
    targetId: student.id,
    meta: { concept: input.concept, observed: input.observed },
  });
  return { observed: input.observed };
}
