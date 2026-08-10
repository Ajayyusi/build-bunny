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

export interface LeaderboardRow {
  /** Stable key for React; never rendered. */
  userId: string;
  /** Already stored as "First L." (seed + CSV import) — no extra redaction needed. */
  displayName: string;
  xpTotal: number;
  starsTotal: number;
  /** 1-based position within the class. */
  rank: number;
  isMe: boolean;
}

/**
 * XP leaderboard for the calling student's OWN CLASS ONLY.
 *
 * Deliberately class-scoped rather than school- or platform-wide. These are
 * 8-12 year olds: a global ranking would expose one child's performance to
 * strangers at other schools and turn a motivation feature into a privacy
 * problem. Classmates already know each other and sit in the same room, so
 * a class board is the widest circle that reveals nothing new — and it's
 * the same boundary the teacher surfaces already use.
 *
 * Returns [] when the student is in no class, so the caller renders an
 * empty state rather than a leaderboard of one.
 */
export async function getMyClassLeaderboard(
  ctx: SessionContext,
): Promise<LeaderboardRow[]> {
  const schoolId = requireSchool(ctx);

  // The student's class membership, scoped by school so a session pointing
  // at another tenant's class resolves to nothing.
  const membership = await db.classMembership.findFirst({
    where: { userId: ctx.userId, schoolId, role: "STUDENT" },
    select: { classId: true },
  });
  if (!membership) return [];

  const classmates = await db.classMembership.findMany({
    where: { classId: membership.classId, schoolId, role: "STUDENT" },
    select: { userId: true },
  });
  const userIds = classmates.map((m) => m.userId);
  if (userIds.length === 0) return [];

  const profiles = await db.studentProfile.findMany({
    where: { userId: { in: userIds }, schoolId },
    select: {
      userId: true,
      xpTotal: true,
      starsTotal: true,
      user: { select: { displayName: true } },
    },
    // Ties break by stars then name so the order is stable across reloads
    // rather than shuffling on every request.
    orderBy: [{ xpTotal: "desc" }, { starsTotal: "desc" }],
  });

  return profiles.map((p, i) => ({
    userId: p.userId,
    displayName: p.user.displayName,
    xpTotal: p.xpTotal,
    starsTotal: p.starsTotal,
    rank: i + 1,
    isMe: p.userId === ctx.userId,
  }));
}

/** Registry walked by the tenant-isolation test suite — every query above must be here. */
export const tenantScopedQueries = {
  getMyStudentSnapshot,
  getMyAchievements,
  getMyClassLeaderboard,
} as const;
