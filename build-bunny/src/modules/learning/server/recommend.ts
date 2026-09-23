import "server-only";

import { z } from "zod";

import { db } from "@/lib/db";
import type { SessionContext } from "@/modules/auth/server/session";
import { localizedText, type LocalizedText } from "@/modules/curriculum/schemas";

import { computeAdventureState, type AdventureState } from "./adventure";

/** The two published fields this decision needs — strict shape, nothing else survives. */
const snapshotTextSchema = z.object({
  title: localizedText,
  tags: z.array(z.string()).default([]),
});

/**
 * "What should I do next?" when a child is stuck — from observable signals
 * only, never a label or a rank.
 *
 * Signals on the current level: failed runs, and how far up the hint ladder
 * the child has gone. Stuck = three or more failed runs AND either a tier-2+
 * hint or five failed runs. The recommendation is always a level the child
 * has ALREADY completed that teaches the same concept (by tag) — the Learn
 * step for it when there is one — offered as a warm-up, with the current
 * level still one tap away. A child who is not stuck gets nothing.
 *
 * Reads only the calling student's own attempt/hint rows and the levels of
 * their own programme (registered in tenantScopedQueries).
 */

export interface WarmUpRecommendation {
  levelId: string;
  title: LocalizedText;
  stuckLevelId: string;
  stuckTitle: LocalizedText;
  /** What was observed — for the UI copy and for teachers, never a score. */
  signals: { failedRuns: number; hintTier: number };
}

const STUCK_FAILS = 3;
const STUCK_FAILS_ALONE = 5;
const STUCK_HINT_TIER = 2;

export async function recommendWarmUp(
  ctx: SessionContext,
  state?: AdventureState,
): Promise<WarmUpRecommendation | null> {
  const schoolId = ctx.schoolId;
  if (!schoolId) return null;
  const adventure = state ?? (await computeAdventureState(ctx));
  const currentId = adventure.currentLevelId;
  if (!currentId) return null;

  const [failedRuns, topHint] = await Promise.all([
    db.activityAttempt.count({
      where: {
        studentUserId: ctx.userId,
        schoolId,
        levelId: currentId,
        kind: "NORMAL",
        verdict: "FAIL",
      },
    }),
    db.hintUsage.findFirst({
      where: { studentUserId: ctx.userId, schoolId, levelId: currentId },
      orderBy: { tier: "desc" },
      select: { tier: true },
    }),
  ]);
  const hintTier = topHint?.tier ?? 0;
  const stuck =
    failedRuns >= STUCK_FAILS && (hintTier >= STUCK_HINT_TIER || failedRuns >= STUCK_FAILS_ALONE);
  if (!stuck) return null;

  // Completed levels earlier on the trail, in trail order.
  const completedIds: string[] = [];
  for (const world of adventure.worlds) {
    for (const mod of world.modules) {
      for (const level of mod.levels) {
        if (level.id === currentId) break;
        if (level.state === "COMPLETED") completedIds.push(level.id);
      }
    }
  }
  if (completedIds.length === 0) return null;

  // Titles and tags come from the PUBLISHED snapshot, never the draft row —
  // the same rule every student surface follows (the draft may be mid-edit).
  const levels = await db.level.findMany({
    where: {
      id: { in: [currentId, ...completedIds] },
      status: "PUBLISHED",
      publishedVersionId: { not: null },
    },
    select: { id: true, activityType: true, publishedVersionId: true },
  });
  const versions = await db.levelVersion.findMany({
    where: { id: { in: levels.map((level) => level.publishedVersionId as string) } },
    select: { levelId: true, snapshot: true },
  });
  const rows = levels.flatMap((level) => {
    const snapshot = versions.find((v) => v.levelId === level.id)?.snapshot;
    const parsed = snapshotTextSchema.safeParse(snapshot);
    return parsed.success
      ? [{ id: level.id, activityType: level.activityType, ...parsed.data }]
      : [];
  });
  const current = rows.find((row) => row.id === currentId);
  if (!current) return null;
  const shared = (tags: string[]) => tags.some((tag) => current.tags.includes(tag));

  const order = new Map(completedIds.map((id, index) => [id, index]));
  const candidates = rows
    .filter((row) => row.id !== currentId && shared(row.tags))
    .sort((a, b) => (order.get(b.id) ?? -1) - (order.get(a.id) ?? -1)); // most recent first
  const pick =
    candidates.find((row) => row.activityType === "CONCEPT_CARDS") ?? candidates[0] ?? null;
  if (!pick) return null;

  return {
    levelId: pick.id,
    title: pick.title,
    stuckLevelId: current.id,
    stuckTitle: current.title,
    signals: { failedRuns, hintTier },
  };
}
