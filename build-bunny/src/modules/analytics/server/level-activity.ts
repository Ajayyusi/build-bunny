import "server-only";

import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

/**
 * Shared "most-attempted / most-failed level" ranking, reused by both
 * school.ts (one school) and platform.ts (every school) — the only
 * difference between the two callers is whether `where` carries a schoolId
 * filter. Built on LearningEvent RUN_SUCCEEDED/RUN_FAILED rows rather than
 * ActivityAttempt: RUN_EXECUTED always pairs with exactly one of the two
 * (submit.ts records both in the same transaction), so success+failed here
 * equals total attempts, and the query hits LearningEvent's
 * `[schoolId, type, createdAt]` index whenever the caller filters by
 * schoolId (school.ts's case) — a schoolId-less platform rollup (platform.ts)
 * cannot use that index prefix and is a bounded scan instead, which is
 * acceptable at V1 platform scale (see docs/operations.md load numbers).
 */

export interface LevelActivityStat {
  levelId: string;
  /** RUN_SUCCEEDED count (verdict PASS or PARTIAL). */
  success: number;
  /** RUN_FAILED count (verdict FAIL or ERROR). */
  failed: number;
}

export async function computeLevelActivityStats(
  where: Prisma.LearningEventWhereInput,
): Promise<LevelActivityStat[]> {
  const rows = await db.learningEvent.groupBy({
    by: ["levelId", "type"],
    where: { ...where, type: { in: ["RUN_SUCCEEDED", "RUN_FAILED"] } },
    _count: { _all: true },
  });
  const byLevel = new Map<string, LevelActivityStat>();
  for (const row of rows) {
    if (!row.levelId) continue; // never happens for RUN_SUCCEEDED/RUN_FAILED, but the column is nullable
    const stat = byLevel.get(row.levelId) ?? { levelId: row.levelId, success: 0, failed: 0 };
    if (row.type === "RUN_SUCCEEDED") stat.success += row._count._all;
    else stat.failed += row._count._all;
    byLevel.set(row.levelId, stat);
  }
  return [...byLevel.values()];
}

export interface RankedLevelStat {
  levelId: string;
  attempts: number;
  failRatePct: number;
}

/** Highest attempt-count levels first — "what are students doing the most". */
export function rankMostAttempted(stats: LevelActivityStat[], limit: number): RankedLevelStat[] {
  return stats
    .map((s) => ({ levelId: s.levelId, attempts: s.success + s.failed, failRatePct: rate(s) }))
    .sort((a, b) => b.attempts - a.attempts)
    .slice(0, limit);
}

// Below this many attempts a fail rate is noise (one unlucky run reads as
// "100% fail") — the content-quality signal only means something with a
// minimum sample.
const MIN_ATTEMPTS_FOR_FAIL_RATE = 3;

/** Highest fail-rate levels first — a content-quality signal, not a blame list. */
export function rankMostFailed(stats: LevelActivityStat[], limit: number): RankedLevelStat[] {
  return stats
    .map((s) => ({ levelId: s.levelId, attempts: s.success + s.failed, failRatePct: rate(s) }))
    .filter((s) => s.attempts >= MIN_ATTEMPTS_FOR_FAIL_RATE)
    .sort((a, b) => b.failRatePct - a.failRatePct || b.attempts - a.attempts)
    .slice(0, limit);
}

function rate(s: LevelActivityStat): number {
  const attempts = s.success + s.failed;
  return attempts > 0 ? Math.round((s.failed / attempts) * 100) : 0;
}
