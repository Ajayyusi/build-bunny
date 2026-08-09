import "server-only";

import type { Prisma } from "@prisma/client";

import { localizedText, type LocalizedText } from "@/modules/curriculum/schemas";

/**
 * Data-driven achievements (m3 contract). Definitions live in the Achievement
 * table with a criteria JSON; evaluation reads the student's CURRENT state
 * inside the reward transaction, so a badge can never be earned twice (the
 * StudentAchievement unique constraint backs the check-then-create).
 * Unknown criteria types are skipped silently — new types ship as data first,
 * evaluators second, without breaking old app versions.
 */

export interface NewAchievement {
  slug: string;
  name: LocalizedText;
  icon: string;
}

interface CriteriaShapes {
  FIRST_PASS: Record<string, never>;
  LEVELS_PASSED: { count: number };
  LEVELS_WITH_TAG: { tag: string; count: number };
  STARS_TOTAL: { count: number };
  WORLD_COMPLETED: { worldSlug?: string };
  STREAK_DAYS: { days: number };
  ACTIVITY_TYPE_PASSED: { activityType: string };
}

interface StudentRewardState {
  starsTotal: number;
  streakBest: number;
  /** COMPLETED levels with the facts criteria evaluate over. */
  completedLevels: { levelId: string; tags: string[]; activityType: string; worldId: string }[];
  /** Worlds where every published level is COMPLETED, by slug. */
  completedWorldSlugs: Set<string>;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function criteriaSatisfied(criteria: unknown, state: StudentRewardState): boolean {
  if (!criteria || typeof criteria !== "object" || Array.isArray(criteria)) return false;
  const record = criteria as Record<string, unknown>;
  const type = record["type"];
  if (typeof type !== "string") return false;

  switch (type as keyof CriteriaShapes) {
    case "FIRST_PASS":
      return state.completedLevels.length >= 1;
    case "LEVELS_PASSED": {
      const count = asNumber(record["count"]);
      return count !== null && state.completedLevels.length >= count;
    }
    case "LEVELS_WITH_TAG": {
      const tag = record["tag"];
      const count = asNumber(record["count"]);
      if (typeof tag !== "string" || count === null) return false;
      const matching = state.completedLevels.filter((l) => l.tags.includes(tag));
      return matching.length >= count;
    }
    case "STARS_TOTAL": {
      const count = asNumber(record["count"]);
      return count !== null && state.starsTotal >= count;
    }
    case "WORLD_COMPLETED": {
      const worldSlug = record["worldSlug"];
      if (typeof worldSlug === "string") return state.completedWorldSlugs.has(worldSlug);
      return state.completedWorldSlugs.size >= 1;
    }
    case "STREAK_DAYS": {
      const days = asNumber(record["days"]);
      // Best (not current) streak: "reached a 7-day streak" stays earned
      // even after the streak later breaks.
      return days !== null && state.streakBest >= days;
    }
    case "ACTIVITY_TYPE_PASSED": {
      const activityType = record["activityType"];
      return (
        typeof activityType === "string" &&
        state.completedLevels.some((l) => l.activityType === activityType)
      );
    }
    default:
      return false; // unknown criteria type: data ahead of code — skip
  }
}

async function loadState(
  tx: Prisma.TransactionClient,
  student: { studentUserId: string; schoolId: string },
): Promise<StudentRewardState> {
  const [profile, completedRows] = await Promise.all([
    tx.studentProfile.findFirst({
      where: { userId: student.studentUserId, schoolId: student.schoolId },
      select: { starsTotal: true, streakBest: true },
    }),
    tx.studentProgress.findMany({
      where: {
        studentUserId: student.studentUserId,
        schoolId: student.schoolId,
        status: "COMPLETED",
      },
      select: {
        levelId: true,
        level: {
          select: {
            tags: true,
            activityType: true,
            module: { select: { worldId: true } },
          },
        },
      },
    }),
  ]);

  const completedLevels = completedRows.map((row) => ({
    levelId: row.levelId,
    tags: row.level.tags,
    activityType: row.level.activityType as string,
    worldId: row.level.module.worldId,
  }));

  // World completion = every PUBLISHED level of the world is COMPLETED.
  // Only worlds the student has touched can possibly qualify — one grouped
  // count query per candidate world keeps this cheap.
  const touchedWorldIds = [...new Set(completedLevels.map((l) => l.worldId))];
  const completedWorldSlugs = new Set<string>();
  if (touchedWorldIds.length > 0) {
    const worlds = await tx.world.findMany({
      where: { id: { in: touchedWorldIds }, horizon: false },
      select: {
        id: true,
        slug: true,
        modules: {
          select: {
            levels: {
              where: { status: "PUBLISHED", publishedVersionId: { not: null } },
              select: { id: true },
            },
          },
        },
      },
    });
    const completedIds = new Set(completedLevels.map((l) => l.levelId));
    for (const world of worlds) {
      const publishedIds = world.modules.flatMap((m) => m.levels.map((l) => l.id));
      if (publishedIds.length > 0 && publishedIds.every((id) => completedIds.has(id))) {
        completedWorldSlugs.add(world.slug);
      }
    }
  }

  return {
    starsTotal: profile?.starsTotal ?? 0,
    streakBest: profile?.streakBest ?? 0,
    completedLevels,
    completedWorldSlugs,
  };
}

/**
 * Evaluate every achievement definition against the student's current state
 * and award the newly-satisfied ones. Must run INSIDE the reward transaction,
 * AFTER progress/profile/streak updates, so criteria see this run's effects.
 * Returns only the achievements earned by this call.
 */
export async function evaluateAchievements(
  tx: Prisma.TransactionClient,
  student: { studentUserId: string; schoolId: string },
): Promise<NewAchievement[]> {
  const definitions = await tx.achievement.findMany({
    orderBy: { order: "asc" },
    select: { id: true, slug: true, name: true, icon: true, criteria: true },
  });
  if (definitions.length === 0) return [];

  const earned = await tx.studentAchievement.findMany({
    where: { studentUserId: student.studentUserId },
    select: { achievementId: true },
  });
  const earnedIds = new Set(earned.map((e) => e.achievementId));
  const candidates = definitions.filter((d) => !earnedIds.has(d.id));
  if (candidates.length === 0) return [];

  const state = await loadState(tx, student);
  const newAchievements: NewAchievement[] = [];
  for (const def of candidates) {
    if (!criteriaSatisfied(def.criteria, state)) continue;
    await tx.studentAchievement.create({
      data: {
        schoolId: student.schoolId,
        studentUserId: student.studentUserId,
        achievementId: def.id,
      },
    });
    const name = localizedText.safeParse(def.name);
    newAchievements.push({
      slug: def.slug,
      name: name.success ? name.data : { en: def.slug },
      icon: def.icon,
    });
  }
  return newAchievements;
}
