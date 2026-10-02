import "server-only";

import type { LearningEventType } from "@prisma/client";

import { db } from "@/lib/db";

/**
 * The handoff's four AI analytics — start, test, retry, completion — counted
 * from the learning-event stream:
 *   starts      LEVEL_SESSION_STARTED (every session) + LEVEL_STARTED (first
 *               open, recorded before sessions were);
 *   tests       RUN_EXECUTED (graded checks) + AI_TEST (in-level tests: the
 *               bunny's guesses, the computer's turn, a mystery round…);
 *   retries     AI_RETRY (a check after a failed one, more squares, another
 *               guess, another choice);
 *   completions LEVEL_COMPLETED.
 * Counts only, never which child did what.
 */

export const AI_ACTIVITY_TYPES = ["AI_CLASSIFICATION", "PATTERN_RECOGNITION", "AI_SIM", "AI_ETHICS"] as const;

export interface AiActivityCounts {
  starts: number;
  tests: number;
  retries: number;
  completions: number;
}

const COUNTED: LearningEventType[] = [
  "LEVEL_SESSION_STARTED",
  "LEVEL_STARTED",
  "RUN_EXECUTED",
  "AI_TEST",
  "AI_RETRY",
  "LEVEL_COMPLETED",
];

export const emptyCounts = (): AiActivityCounts => ({ starts: 0, tests: 0, retries: 0, completions: 0 });

export function addEvent(counts: AiActivityCounts, type: LearningEventType, n: number): void {
  if (type === "LEVEL_SESSION_STARTED" || type === "LEVEL_STARTED") counts.starts += n;
  else if (type === "RUN_EXECUTED" || type === "AI_TEST") counts.tests += n;
  else if (type === "AI_RETRY") counts.retries += n;
  else if (type === "LEVEL_COMPLETED") counts.completions += n;
}

/** This school's AI levels (by activity type), from the given level ids. */
export async function aiLevelIdsOf(levelIds: string[]): Promise<string[]> {
  if (levelIds.length === 0) return [];
  const rows = await db.level.findMany({
    where: { id: { in: levelIds }, activityType: { in: [...AI_ACTIVITY_TYPES] } },
    select: { id: true },
  });
  return rows.map((row) => row.id);
}

/** Event counts grouped by `by` (per level or per student), within a school. */
export async function countAiEvents(input: {
  schoolId: string;
  levelIds: string[];
  studentIds?: string[];
  since?: Date;
  by: "levelId" | "studentUserId";
}): Promise<Map<string, AiActivityCounts>> {
  const result = new Map<string, AiActivityCounts>();
  if (input.levelIds.length === 0 || input.studentIds?.length === 0) return result;
  const rows = await db.learningEvent.groupBy({
    by: [input.by, "type"],
    where: {
      schoolId: input.schoolId,
      type: { in: COUNTED },
      levelId: { in: input.levelIds },
      ...(input.studentIds ? { studentUserId: { in: input.studentIds } } : {}),
      ...(input.since ? { createdAt: { gte: input.since } } : {}),
    },
    _count: { _all: true },
  });
  for (const row of rows) {
    const key = (input.by === "levelId" ? row.levelId : row.studentUserId) ?? "";
    const counts = result.get(key) ?? emptyCounts();
    addEvent(counts, row.type, row._count._all);
    result.set(key, counts);
  }
  return result;
}

/**
 * The handoff's "return session": children whose AI activity in the window
 * falls on two or more different days (calendar days in the school's
 * timezone), so they came back to it rather than finishing in one sitting.
 * Returns the children's ids for the caller to COUNT per class; nothing
 * leaves the server but the counts.
 */
export async function returningAiStudents(input: {
  schoolId: string;
  levelIds: string[];
  since: Date;
  timeZone: string;
}): Promise<Set<string>> {
  if (input.levelIds.length === 0) return new Set();
  const rows = await db.$queryRaw<{ studentUserId: string }[]>`
    SELECT "studentUserId"
    FROM "LearningEvent"
    WHERE "schoolId" = ${input.schoolId}
      AND "createdAt" >= (${input.since}::timestamptz AT TIME ZONE 'UTC')
      AND "levelId" = ANY(${input.levelIds})
      AND "type"::text IN ('LEVEL_SESSION_STARTED', 'LEVEL_STARTED', 'RUN_EXECUTED', 'AI_TEST', 'AI_RETRY', 'LEVEL_COMPLETED')
    GROUP BY 1
    HAVING COUNT(DISTINCT (("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${input.timeZone})::date) >= 2`;
  return new Set(rows.map((row) => row.studentUserId));
}

/**
 * Minutes from each child's first session start on a level to their first
 * completion of it, within the hour (analytics/first-session.ts). Numbers
 * only, no ids, for one school.
 */
export async function firstSessionMinutes(input: { schoolId: string; levelId: string; since: Date }): Promise<number[]> {
  const rows = await db.$queryRaw<{ minutes: number }[]>`
    WITH s AS (
      SELECT "studentUserId", MIN("createdAt") AS t0
      FROM "LearningEvent"
      WHERE "schoolId" = ${input.schoolId} AND "levelId" = ${input.levelId} AND "type"::text = 'LEVEL_SESSION_STARTED'
      GROUP BY 1
    ), c AS (
      SELECT "studentUserId", MIN("createdAt") AS t1
      FROM "LearningEvent"
      WHERE "schoolId" = ${input.schoolId} AND "levelId" = ${input.levelId} AND "type"::text = 'LEVEL_COMPLETED'
      GROUP BY 1
    )
    SELECT EXTRACT(EPOCH FROM (c.t1 - s.t0)) / 60.0 AS minutes
    FROM s JOIN c USING ("studentUserId")
    WHERE s.t0 >= (${input.since}::timestamptz AT TIME ZONE 'UTC') AND c.t1 >= s.t0 AND c.t1 - s.t0 < INTERVAL '60 minutes'`;
  return rows.map((row) => Number(row.minutes));
}
