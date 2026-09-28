import "server-only";

import { db } from "@/lib/db";
import type { SessionContext } from "@/modules/auth/server/session";
import { localizedText, type LocalizedText } from "@/modules/curriculum/schemas";
import { forStudents, secureByConcept, summariseAiConcepts, type AiConcept } from "../ai-concepts";
import { weekStarts, weeklySeries, type WeekRow } from "../weekly";
import { aiLevelIdsOf, countAiEvents, emptyCounts, type AiActivityCounts } from "./ai-activity";
import { loadConceptInput } from "./ai-concepts-load";
import { computeLevelActivityStats, rankMostAttempted, rankMostFailed } from "./level-activity";

/**
 * School-admin analytics (M5 task 2 §1). One composite query — like
 * teacher.ts's ClassMatrix — because every figure on the /school dashboard
 * shares the same underlying joins (school roster, published-level set,
 * completion rows); computing them separately would repeat those reads.
 * SCHOOL_ADMIN only (analytics:school permission); a TEACHER gets the
 * narrower class-scoped view in analytics/server/teacher.ts instead.
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

export interface SchoolAnalyticsGrade {
  grade: number;
  studentCount: number;
  completionPct: number;
  avgStars: number;
}

export interface SchoolAnalyticsClass {
  classId: string;
  className: string;
  grade: number;
  studentCount: number;
  completionPct: number;
  avgStars: number;
  activeThisWeek: number;
}

export interface SchoolAnalyticsLevel {
  levelId: string;
  slug: string;
  title: LocalizedText;
  worldSlug: string;
  worldName: LocalizedText;
  attempts: number;
  failRatePct: number;
}

/** Secure counts per AI concept, for one class. */
export interface SchoolAiConceptsClass {
  classId: string;
  className: string;
  concepts: Record<AiConcept, { secure: number; students: number; levels: number }>;
}

/** AI activity in one class over the last 30 days (counts only). */
export interface SchoolAiActivityClass extends AiActivityCounts {
  classId: string;
  className: string;
  studentCount: number;
}

export interface SchoolAnalytics {
  totalStudents: number;
  activeStudentsThisWeek: number;
  activeStudentsThisMonth: number;
  certificatesIssued: number;
  licenceSeatsUsed: number;
  licenceSeatsTotal: number | null;
  avgStarsAcrossCompletions: number;
  byGrade: SchoolAnalyticsGrade[];
  byClass: SchoolAnalyticsClass[];
  mostAttemptedLevels: SchoolAnalyticsLevel[];
  mostFailedLevels: SchoolAnalyticsLevel[];
  /** Start, test, retry and completion in AI activities, by class, last 30 days. */
  aiActivity: SchoolAiActivityClass[];
  /** The same, for the whole school. */
  aiActivityTotal: AiActivityCounts;
  /** AI concept mastery (secure) by class — the concept trends. */
  aiConceptsByClass: SchoolAiConceptsClass[];
  /** AI activity week by week, the last 8 weeks, oldest first. */
  aiWeekly: WeekRow[];
}

interface LevelIndexEntry {
  slug: string;
  title: LocalizedText;
  worldSlug: string;
  worldName: LocalizedText;
}

/**
 * Published levels reachable by this school's enabled program(s), id-keyed
 * for O(1) lookup. Mirrors teacher.ts's loadSchoolLevels tree walk (Program →
 * ProgramWorld → World → Module → Level are all platform-global, small
 * tables — the walk itself needs no special index).
 */
async function loadSchoolLevelIndex(schoolId: string): Promise<Map<string, LevelIndexEntry>> {
  const index = new Map<string, LevelIndexEntry>();
  const enabled = await db.schoolProgram.findMany({
    where: { schoolId },
    select: { programId: true },
  });
  if (enabled.length === 0) return index;

  const programWorlds = await db.programWorld.findMany({
    where: {
      programId: { in: enabled.map((e) => e.programId) },
      world: { status: "PUBLISHED", horizon: false },
    },
    select: {
      world: {
        select: {
          slug: true,
          name: true,
          modules: {
            select: {
              levels: {
                where: { status: "PUBLISHED", publishedVersionId: { not: null } },
                select: { id: true, slug: true, title: true },
              },
            },
          },
        },
      },
    },
  });
  for (const { world } of programWorlds) {
    const worldName = asText(world.name, world.slug);
    for (const mod of world.modules) {
      for (const level of mod.levels) {
        if (!index.has(level.id)) {
          index.set(level.id, {
            slug: level.slug,
            title: asText(level.title, level.slug),
            worldSlug: world.slug,
            worldName,
          });
        }
      }
    }
  }
  return index;
}

/** Licence to report seat totals against: prefer an ACTIVE/GRACE one, else the most recently expired. */
function pickReportingLicence<T extends { status: string; expiresAt: Date; seats: number }>(
  licences: T[],
): T | null {
  if (licences.length === 0) return null;
  const priority: Record<string, number> = { ACTIVE: 0, GRACE: 1, READ_ONLY: 2, SUSPENDED: 3 };
  return [...licences].sort((a, b) => {
    const byStatus = (priority[a.status] ?? 9) - (priority[b.status] ?? 9);
    return byStatus !== 0 ? byStatus : b.expiresAt.getTime() - a.expiresAt.getTime();
  })[0]!;
}

export async function getSchoolAnalytics(ctx: SessionContext): Promise<SchoolAnalytics | null> {
  const schoolId = requireSchool(ctx);
  if (ctx.role !== "SCHOOL_ADMIN") return null;

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const levelIndex = await loadSchoolLevelIndex(schoolId);
  const levelIds = [...levelIndex.keys()];
  const totalLevels = levelIds.length;

  const [students, classes, memberships, progressAgg, certificatesIssued, licences, levelStats] =
    await Promise.all([
      db.studentProfile.findMany({
        where: { schoolId },
        select: { userId: true, grade: true, lastActiveDate: true },
      }),
      db.class.findMany({ where: { schoolId }, select: { id: true, name: true, grade: true } }),
      db.classMembership.findMany({
        where: { schoolId, role: "STUDENT" },
        select: { classId: true, userId: true },
      }),
      // Hits StudentProgress's [schoolId, levelId] index: equality on schoolId,
      // IN-list on levelId — both leading columns of the compound index.
      totalLevels > 0
        ? db.studentProgress.groupBy({
            by: ["studentUserId"],
            where: { schoolId, status: "COMPLETED", levelId: { in: levelIds } },
            _count: { _all: true },
            _sum: { stars: true },
          })
        : Promise.resolve([]),
      // Hits Certificate's [schoolId, issuedAt] index (equality on schoolId).
      db.certificate.count({ where: { schoolId, revokedAt: null } }),
      db.licence.findMany({ where: { schoolId }, orderBy: { expiresAt: "desc" } }),
      // Hits LearningEvent's [schoolId, type, createdAt] index (equality on
      // both schoolId and type — see level-activity.ts).
      computeLevelActivityStats({ schoolId }),
    ]);

  const completedByStudent = new Map(
    progressAgg.map((r) => [r.studentUserId, { completed: r._count._all, stars: r._sum.stars ?? 0 }]),
  );
  const studentIdsByClass = new Map<string, string[]>();
  for (const m of memberships) {
    const list = studentIdsByClass.get(m.classId) ?? [];
    list.push(m.userId);
    studentIdsByClass.set(m.classId, list);
  }

  interface GradeAgg {
    studentCount: number;
    completed: number;
    stars: number;
  }
  const gradeMap = new Map<number, GradeAgg>();
  let activeThisWeek = 0;
  let activeThisMonth = 0;
  let schoolCompleted = 0;
  let schoolStars = 0;

  for (const student of students) {
    const agg = gradeMap.get(student.grade) ?? { studentCount: 0, completed: 0, stars: 0 };
    agg.studentCount += 1;
    const completion = completedByStudent.get(student.userId);
    if (completion) {
      agg.completed += completion.completed;
      agg.stars += completion.stars;
      schoolCompleted += completion.completed;
      schoolStars += completion.stars;
    }
    gradeMap.set(student.grade, agg);
    if (student.lastActiveDate && student.lastActiveDate >= weekAgo) activeThisWeek += 1;
    if (student.lastActiveDate && student.lastActiveDate >= monthAgo) activeThisMonth += 1;
  }

  const byGrade: SchoolAnalyticsGrade[] = [...gradeMap.entries()]
    .sort(([a], [b]) => a - b)
    .map(([grade, agg]) => ({
      grade,
      studentCount: agg.studentCount,
      completionPct:
        totalLevels > 0 && agg.studentCount > 0
          ? Math.round((agg.completed / (agg.studentCount * totalLevels)) * 100)
          : 0,
      avgStars: agg.completed > 0 ? Math.round((agg.stars / agg.completed) * 10) / 10 : 0,
    }));

  const lastActiveByStudent = new Map(students.map((s) => [s.userId, s.lastActiveDate]));
  const byClass: SchoolAnalyticsClass[] = classes
    .map((cls) => {
      const studentIds = studentIdsByClass.get(cls.id) ?? [];
      let completed = 0;
      let stars = 0;
      let active = 0;
      for (const studentId of studentIds) {
        const completion = completedByStudent.get(studentId);
        if (completion) {
          completed += completion.completed;
          stars += completion.stars;
        }
        const lastActive = lastActiveByStudent.get(studentId);
        if (lastActive && lastActive >= weekAgo) active += 1;
      }
      return {
        classId: cls.id,
        className: cls.name,
        grade: cls.grade,
        studentCount: studentIds.length,
        completionPct:
          totalLevels > 0 && studentIds.length > 0
            ? Math.round((completed / (studentIds.length * totalLevels)) * 100)
            : 0,
        avgStars: completed > 0 ? Math.round((stars / completed) * 10) / 10 : 0,
        activeThisWeek: active,
      };
    })
    .sort((a, b) => b.completionPct - a.completionPct || a.className.localeCompare(b.className));

  const toLevelRow = (stat: { levelId: string; attempts: number; failRatePct: number }): SchoolAnalyticsLevel => {
    const meta = levelIndex.get(stat.levelId);
    return {
      levelId: stat.levelId,
      slug: meta?.slug ?? stat.levelId,
      title: meta?.title ?? { en: stat.levelId },
      worldSlug: meta?.worldSlug ?? "",
      worldName: meta?.worldName ?? { en: "" },
      attempts: stat.attempts,
      failRatePct: stat.failRatePct,
    };
  };
  const mostAttemptedLevels = rankMostAttempted(levelStats, 5).map(toLevelRow);
  const mostFailedLevels = rankMostFailed(levelStats, 5).map(toLevelRow);

  const reportingLicence = pickReportingLicence(licences);

  // AI activity: per child over the last 30 days, then summed per class (a
  // child in two classes counts in both, as in byClass).
  const aiLevelIds = await aiLevelIdsOf(levelIds);
  const aiByStudent = await countAiEvents({ schoolId, levelIds: aiLevelIds, since: monthAgo, by: "studentUserId" });
  const aiActivityTotal = emptyCounts();
  for (const counts of aiByStudent.values()) {
    aiActivityTotal.starts += counts.starts;
    aiActivityTotal.tests += counts.tests;
    aiActivityTotal.retries += counts.retries;
    aiActivityTotal.completions += counts.completions;
  }
  const aiActivity: SchoolAiActivityClass[] = classes
    .map((cls) => {
      const studentIds = studentIdsByClass.get(cls.id) ?? [];
      const sum = emptyCounts();
      for (const id of studentIds) {
        const counts = aiByStudent.get(id);
        if (!counts) continue;
        sum.starts += counts.starts;
        sum.tests += counts.tests;
        sum.retries += counts.retries;
        sum.completions += counts.completions;
      }
      return { classId: cls.id, className: cls.name, studentCount: studentIds.length, ...sum };
    })
    .sort((a, b) => b.starts - a.starts || a.className.localeCompare(b.className));

  // Concept mastery by class: one load for the school, summarised per class.
  const conceptInput = await loadConceptInput(
    schoolId,
    students.map((s) => s.userId),
    [...levelIndex].map(([id, meta]) => ({ id, slug: meta.slug })),
  );
  const aiConceptsByClass: SchoolAiConceptsClass[] = classes
    .map((cls) => ({
      classId: cls.id,
      className: cls.name,
      concepts: secureByConcept(summariseAiConcepts(forStudents(conceptInput, new Set(studentIdsByClass.get(cls.id) ?? [])))),
    }))
    .sort((a, b) => a.className.localeCompare(b.className));

  // Week by week, over the event index ([schoolId, type, createdAt]).
  const WEEKS = 8;
  const since = new Date(weekStarts(now, WEEKS)[0]! + "T00:00:00Z");
  const weekRows = aiLevelIds.length
    ? await db.$queryRaw<{ week: Date; type: string; n: bigint }[]>`
        SELECT date_trunc('week', "createdAt") AS week, "type"::text AS type, COUNT(*) AS n
        FROM "LearningEvent"
        WHERE "schoolId" = ${schoolId}
          AND "createdAt" >= ${since}
          AND "levelId" = ANY(${aiLevelIds})
          AND "type"::text IN ('LEVEL_SESSION_STARTED', 'LEVEL_STARTED', 'RUN_EXECUTED', 'AI_TEST', 'AI_RETRY', 'LEVEL_COMPLETED')
        GROUP BY 1, 2`
    : [];
  const aiWeekly = weeklySeries(
    weekRows.map((row) => ({ week: new Date(row.week), type: row.type, n: Number(row.n) })),
    now,
    WEEKS,
  );

  return {
    totalStudents: students.length,
    activeStudentsThisWeek: activeThisWeek,
    activeStudentsThisMonth: activeThisMonth,
    certificatesIssued,
    licenceSeatsUsed: students.length,
    licenceSeatsTotal: reportingLicence?.seats ?? null,
    avgStarsAcrossCompletions: schoolCompleted > 0 ? Math.round((schoolStars / schoolCompleted) * 10) / 10 : 0,
    byGrade,
    byClass,
    mostAttemptedLevels,
    mostFailedLevels,
    aiActivity,
    aiActivityTotal,
    aiConceptsByClass,
    aiWeekly,
  };
}
