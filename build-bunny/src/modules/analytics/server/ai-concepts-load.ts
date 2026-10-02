import "server-only";

import { db } from "@/lib/db";
import { CONCEPT_CHECKS } from "@/modules/explore/catalog";

import { AI_CONCEPT_LEVELS, type ConceptInput } from "../ai-concepts";
import { countAiEvents, type AiActivityCounts } from "./ai-activity";

/**
 * The rows behind the five-concept mastery report (analytics/ai-concepts.ts)
 * for some of a school's children: their grades, finished concept levels,
 * quick-check answers, graded checks and retries. One load serves a class
 * (teacher) or the whole school, split by class (school admin).
 */
export async function loadConceptInput(
  schoolId: string,
  studentIds: string[],
  schoolLevels: readonly { id: string; slug: string }[],
): Promise<ConceptInput> {
  const conceptSlugs = new Set(Object.values(AI_CONCEPT_LEVELS).flat());
  const levelIdBySlug = new Map(schoolLevels.filter((l) => conceptSlugs.has(l.slug)).map((l) => [l.slug, l.id]));
  const levelIds = [...levelIdBySlug.values()];
  const checkConceptOf = new Map(
    [...levelIdBySlug].flatMap(([slug, id]) => (CONCEPT_CHECKS[slug] ? [[id, CONCEPT_CHECKS[slug]!.concept] as const] : [])),
  );
  const none = studentIds.length === 0 || levelIds.length === 0;
  const [profiles, completed, checks, attempts, events, sentences, observed] = await Promise.all([
    studentIds.length
      ? db.studentProfile.findMany({ where: { schoolId, userId: { in: studentIds } }, select: { userId: true, grade: true } })
      : Promise.resolve([]),
    none
      ? Promise.resolve([])
      : db.studentProgress.findMany({
          where: { schoolId, levelId: { in: levelIds }, studentUserId: { in: studentIds }, status: "COMPLETED" },
          select: { studentUserId: true, levelId: true, stars: true, firstCompletedAt: true },
        }),
    none
      ? Promise.resolve([])
      : db.conceptCheck.findMany({
          where: { schoolId, levelId: { in: levelIds }, studentUserId: { in: studentIds } },
          select: { studentUserId: true, levelId: true, firstChoice: true, firstCorrect: true, correctAt: true },
        }),
    none
      ? Promise.resolve([])
      : db.activityAttempt.groupBy({
          by: ["levelId"],
          where: { schoolId, levelId: { in: levelIds }, studentUserId: { in: studentIds } },
          _count: { _all: true },
        }),
    none ? Promise.resolve(new Map<string, AiActivityCounts>()) : countAiEvents({ schoolId, levelIds, studentIds, by: "levelId" }),
    none
      ? Promise.resolve([])
      : db.explanationSentence.findMany({
          where: { schoolId, levelId: { in: levelIds }, studentUserId: { in: studentIds }, soundParts: 3 },
          // createdAt, not updatedAt: re-saving a sentence must not move its
          // date forward and fake a rise in the four-week trend.
          select: { studentUserId: true, levelId: true, createdAt: true },
        }),
    studentIds.length
      ? db.conceptObservation.findMany({
          where: { schoolId, studentUserId: { in: studentIds } },
          select: { studentUserId: true, concept: true, createdAt: true },
        })
      : Promise.resolve([]),
  ]);
  return {
    levelIdBySlug,
    students: profiles.map((p) => ({ id: p.userId, grade: p.grade })),
    completed: completed.map((row) => ({ studentId: row.studentUserId, levelId: row.levelId, stars: row.stars, at: row.firstCompletedAt })),
    checks: checks.map((row) => ({
      studentId: row.studentUserId,
      levelId: row.levelId,
      firstChoice: row.firstChoice,
      firstCorrect: row.firstCorrect,
      correct: row.correctAt !== null,
      at: row.correctAt,
    })),
    checkConceptOf,
    attemptsByLevel: new Map(attempts.map((row) => [row.levelId, row._count._all])),
    retriesByLevel: new Map([...events].map(([id, counts]) => [id, counts.retries])),
    soundSentences: sentences.map((row) => ({ studentId: row.studentUserId, levelId: row.levelId, at: row.createdAt })),
    observed: observed.map((row) => ({ studentId: row.studentUserId, concept: row.concept, at: row.createdAt })),
  };
}
