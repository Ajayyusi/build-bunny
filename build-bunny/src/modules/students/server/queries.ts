import "server-only";

import { db } from "@/lib/db";
import type { SessionContext } from "@/modules/auth/server/session";
import { localizedText, type LocalizedText } from "@/modules/curriculum/schemas";

/**
 * Tenant-scoped student self-queries. Same rules as schools/server/queries:
 * SessionContext first, schoolId derived from ctx only, compound lookups, and
 * every exported query registered in `tenantScopedQueries` below.
 */

function requireSchool(ctx: SessionContext): string {
  if (!ctx.schoolId) {
    throw new Error("This operation requires a school-scoped session");
  }
  return ctx.schoolId;
}

function asText(value: unknown, fallback: string): LocalizedText {
  const parsed = localizedText.safeParse(value);
  return parsed.success ? parsed.data : { en: fallback };
}

/**
 * The calling student's own profile snapshot for the student shell: identity,
 * gamification counters and school name in one read. findFirst (not findUnique
 * on the PK) so the schoolId stays part of the lookup — a session pointing at
 * a profile from another school resolves to nothing.
 */
export async function getMyStudentSnapshot(ctx: SessionContext) {
  const schoolId = requireSchool(ctx);
  return db.studentProfile.findFirst({
    where: { userId: ctx.userId, schoolId },
    select: {
      grade: true,
      xpTotal: true,
      starsTotal: true,
      streakCurrent: true,
      user: {
        select: {
          displayName: true,
          displayUsername: true,
          avatarId: true,
        },
      },
      // features feeds the student shell's flag gating (e.g. the Adventure
      // nav item) — one read serves both identity and surface visibility.
      school: { select: { name: true, features: true } },
    },
  });
}

export interface MyAchievementBadge {
  slug: string;
  name: LocalizedText;
  description: LocalizedText;
  icon: string;
  /** null = not yet earned (the achievements page renders this as a locked silhouette). */
  earnedAt: string | null;
}

/**
 * Every platform-global Achievement definition, joined with the calling
 * student's own StudentAchievement rows. Achievement.description is already
 * authored as the child-friendly "how to earn this" copy (prisma/seed-data
 * /achievements.ts) — locked badges reuse it verbatim rather than deriving
 * a second criteria-description format from the criteria JSON.
 */
export async function getMyAchievements(ctx: SessionContext): Promise<MyAchievementBadge[]> {
  const schoolId = requireSchool(ctx);
  const [definitions, earned] = await Promise.all([
    db.achievement.findMany({
      orderBy: { order: "asc" },
      select: { id: true, slug: true, name: true, description: true, icon: true },
    }),
    db.studentAchievement.findMany({
      where: { studentUserId: ctx.userId, schoolId },
      select: { achievementId: true, earnedAt: true },
    }),
  ]);
  const earnedByAchievementId = new Map(earned.map((row) => [row.achievementId, row.earnedAt]));
  return definitions.map((def) => {
    const earnedAt = earnedByAchievementId.get(def.id);
    return {
      slug: def.slug,
      name: asText(def.name, def.slug),
      description: asText(def.description, ""),
      icon: def.icon,
      earnedAt: earnedAt ? earnedAt.toISOString() : null,
    };
  });
}

/** Registry walked by the tenant-isolation test suite — every query above must be here. */
export const tenantScopedQueries = {
  getMyStudentSnapshot,
  getMyAchievements,
} as const;
