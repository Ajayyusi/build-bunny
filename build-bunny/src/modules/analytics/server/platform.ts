import "server-only";

import { db } from "@/lib/db";
import type { SessionContext } from "@/modules/auth/server/session";
import { localizedText, type LocalizedText } from "@/modules/curriculum/schemas";
import { computeLevelActivityStats, rankMostFailed } from "./level-activity";

/**
 * Platform-wide analytics (M5 task 2 §2) — SUPER_ADMIN/NITAQ_ADMIN only.
 * Guarded like schools/server/platform-queries.ts: NOT a tenant-scoped
 * query, so deliberately NOT exported from ./queries.ts / the
 * tenantScopedQueries registry (cross-school reads are the whole point
 * here). Several reads below cannot filter by schoolId at all — the three
 * named indexes (schoolId+createdAt, studentUserId+createdAt,
 * schoolId+type+createdAt on LearningEvent; schoolId+levelId on progress)
 * are all schoolId-prefixed, so a genuinely cross-tenant rollup cannot seek
 * through them. Each such read is bounded instead (a 14-day window, or a
 * small platform-global table) — called out at the point of use.
 */

function requirePlatform(ctx: SessionContext): void {
  if (ctx.role !== "SUPER_ADMIN" && ctx.role !== "NITAQ_ADMIN") {
    throw new Error("Platform-only query invoked with a non-platform session");
  }
}

function asText(value: unknown, fallback: string): LocalizedText {
  const parsed = localizedText.safeParse(value);
  return parsed.success ? parsed.data : { en: fallback };
}

function utcDateOnly(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function utcDateKey(d: Date): string {
  return utcDateOnly(d).toISOString().slice(0, 10);
}

export interface PlatformDailyAttempts {
  /** ISO date (YYYY-MM-DD), UTC calendar day — a platform rollup has no single school timezone. */
  date: string;
  attempts: number;
}

export interface PlatformFailedLevel {
  levelId: string;
  slug: string;
  title: LocalizedText;
  worldSlug: string;
  worldName: LocalizedText;
  attempts: number;
  failRatePct: number;
}

export interface PlatformSchoolActivity {
  schoolId: string;
  schoolName: string;
  activeStudentsThisWeek: number;
  totalStudents: number;
}

export interface PlatformLicenceExpiryEntry {
  schoolId: string;
  schoolName: string;
  status: string;
  expiresAt: string;
  seats: number;
}

export interface PlatformAnalytics {
  dauStudents: number;
  wauStudents: number;
  attemptsPerDay14d: PlatformDailyAttempts[];
  mostFailedLevels: PlatformFailedLevel[];
  schoolsByActivity: PlatformSchoolActivity[];
  licenceExpiryPipeline: PlatformLicenceExpiryEntry[];
  certificatesIssuedTotal: number;
}

const DAYS_14 = 14;
// Same horizon getPlatformOverview's licencesExpiringSoon count already uses
// (schools/server/platform-queries.ts) — one consistent "expiring soon" window.
const LICENCE_HORIZON_MS = 60 * 24 * 60 * 60 * 1000;

export async function getPlatformAnalytics(ctx: SessionContext): Promise<PlatformAnalytics> {
  requirePlatform(ctx);

  const now = new Date();
  const today = utcDateOnly(now);
  const weekAgoDate = utcDateOnly(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));
  const fourteenDaysAgo = new Date(now.getTime() - (DAYS_14 - 1) * 24 * 60 * 60 * 1000);
  const fourteenDaysAgoStart = utcDateOnly(fourteenDaysAgo);
  const licenceHorizon = new Date(now.getTime() + LICENCE_HORIZON_MS);

  const [
    dauStudents,
    wauRows,
    recentAttempts,
    levelStats,
    schools,
    weeklyActiveRows,
    studentCounts,
    licences,
    certificatesIssuedTotal,
  ] = await Promise.all([
    // StudentDailyActivity is unique on (studentUserId, date), so counting
    // rows for exactly today's date IS the distinct-student count.
    db.studentDailyActivity.count({ where: { date: today } }),
    db.studentDailyActivity.groupBy({ by: ["studentUserId"], where: { date: { gte: weekAgoDate } } }),
    // Bounded scan: only the trailing 14-day window, not the whole table
    // (ActivityAttempt has no plain-createdAt index — see module comment).
    db.activityAttempt.findMany({
      where: { kind: "NORMAL", createdAt: { gte: fourteenDaysAgoStart } },
      select: { createdAt: true },
    }),
    // Bounded scan for the same reason (LearningEvent's index is
    // schoolId-prefixed; this read has no schoolId filter by design).
    computeLevelActivityStats({}),
    db.school.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.studentDailyActivity.groupBy({
      by: ["schoolId", "studentUserId"],
      where: { date: { gte: weekAgoDate } },
    }),
    db.studentProfile.groupBy({ by: ["schoolId"], _count: { _all: true } }),
    // Hits Licence's [expiresAt] index directly — no schoolId filter needed.
    db.licence.findMany({
      where: { status: { in: ["ACTIVE", "GRACE"] }, expiresAt: { lte: licenceHorizon } },
      orderBy: { expiresAt: "asc" },
      select: { schoolId: true, status: true, expiresAt: true, seats: true, school: { select: { name: true } } },
    }),
    db.certificate.count({ where: { revokedAt: null } }),
  ]);

  const attemptsByDay = new Map<string, number>();
  for (const attempt of recentAttempts) {
    const key = utcDateKey(attempt.createdAt);
    attemptsByDay.set(key, (attemptsByDay.get(key) ?? 0) + 1);
  }
  const attemptsPerDay14d: PlatformDailyAttempts[] = [];
  for (let i = 0; i < DAYS_14; i += 1) {
    const day = new Date(fourteenDaysAgoStart.getTime() + i * 24 * 60 * 60 * 1000);
    const key = utcDateKey(day);
    attemptsPerDay14d.push({ date: key, attempts: attemptsByDay.get(key) ?? 0 });
  }

  const ranked = rankMostFailed(levelStats, 5);
  const levelMeta =
    ranked.length > 0
      ? await db.level.findMany({
          where: { id: { in: ranked.map((r) => r.levelId) } },
          select: {
            id: true,
            slug: true,
            title: true,
            module: { select: { world: { select: { slug: true, name: true } } } },
          },
        })
      : [];
  const levelMetaById = new Map(levelMeta.map((l) => [l.id, l]));
  const mostFailedLevels: PlatformFailedLevel[] = ranked.map((r) => {
    const meta = levelMetaById.get(r.levelId);
    return {
      levelId: r.levelId,
      slug: meta?.slug ?? r.levelId,
      title: asText(meta?.title, meta?.slug ?? r.levelId),
      worldSlug: meta?.module.world.slug ?? "",
      worldName: asText(meta?.module.world.name, meta?.module.world.slug ?? ""),
      attempts: r.attempts,
      failRatePct: r.failRatePct,
    };
  });

  const activeCountBySchool = new Map<string, number>();
  for (const row of weeklyActiveRows) {
    activeCountBySchool.set(row.schoolId, (activeCountBySchool.get(row.schoolId) ?? 0) + 1);
  }
  const studentCountBySchool = new Map(studentCounts.map((r) => [r.schoolId, r._count._all]));
  const schoolsByActivity: PlatformSchoolActivity[] = schools
    .map((s) => ({
      schoolId: s.id,
      schoolName: s.name,
      activeStudentsThisWeek: activeCountBySchool.get(s.id) ?? 0,
      totalStudents: studentCountBySchool.get(s.id) ?? 0,
    }))
    .sort((a, b) => b.activeStudentsThisWeek - a.activeStudentsThisWeek || a.schoolName.localeCompare(b.schoolName));

  const licenceExpiryPipeline: PlatformLicenceExpiryEntry[] = licences.map((l) => ({
    schoolId: l.schoolId,
    schoolName: l.school.name,
    status: l.status,
    expiresAt: l.expiresAt.toISOString(),
    seats: l.seats,
  }));

  return {
    dauStudents,
    wauStudents: wauRows.length,
    attemptsPerDay14d,
    mostFailedLevels,
    schoolsByActivity,
    licenceExpiryPipeline,
    certificatesIssuedTotal,
  };
}
