import "server-only";

import type { AttemptVerdict } from "@prisma/client";

import { db } from "@/lib/db";
import { suggestInterventions, type SuggestedIntervention } from "./intervention";
import { computeLevelActivityStats, rankMostFailed } from "./level-activity";
import type { SessionContext } from "@/modules/auth/server/session";
import { localizedText, type LocalizedText } from "@/modules/curriculum/schemas";
import type { LevelSnapshot } from "@/modules/curriculum/server/publish";
import { gradeWorkspace, type GradeVariantResult } from "@/modules/grading/server/grade";
import type { ProgramRun } from "@/modules/blockly/interpreter";
import {
  localDateKey,
  previousSchoolDay,
  schoolDaysFrom,
} from "@/modules/grading/server/streak";

/**
 * Teacher analytics (m4 pinned interface). Every read here is scoped INSIDE
 * the query, never left to the caller: a TEACHER only ever sees their own
 * classes (ClassMembership role TEACHER for ctx.userId); SCHOOL_ADMIN may
 * see any class in their own school. Flags are named, observable conditions
 * over real rows (attempts/hints/progress/assignments) — never a black-box
 * score — so a teacher can always see WHY a student is flagged.
 */

// ── Pinned interfaces ─────────────────────────────────────────────────────

export interface MatrixLevel {
  id: string;
  slug: string;
  title: LocalizedText;
  order: number;
  worldSlug: string;
  worldName: LocalizedText;
}

export type ProgressState = "LOCKED" | "UNLOCKED" | "IN_PROGRESS" | "COMPLETED";

export interface MatrixCell {
  status: ProgressState;
  stars: number;
  attempts: number;
  hintTierMax: number;
}

export type StudentFlag = "STUCK" | "OVERTIME" | "HEAVY_HINTS" | "INACTIVE" | "NOT_STARTED";

export interface MatrixStudent {
  userId: string;
  displayName: string;
  xpTotal: number;
  starsTotal: number;
  lastActiveAt: string | null;
  flags: StudentFlag[];
  cells: Record<string, MatrixCell>;
}

export interface ClassMatrix {
  classId: string;
  className: string;
  grade: number;
  levels: MatrixLevel[];
  students: MatrixStudent[];
  summary: {
    studentCount: number;
    startedCount: number;
    completionPct: number;
    avgStars: number;
    activeThisWeek: number;
  };
}

export interface TeacherOverviewClass {
  id: string;
  name: string;
  grade: number;
  studentCount: number;
  completionPct: number;
  activeThisWeek: number;
}

export interface TeacherOverviewAttentionEntry {
  studentUserId: string;
  displayName: string;
  className: string;
  flags: StudentFlag[];
  /**
   * Extra field beyond the pinned shape — the student detail route is
   * class-scoped (/teach/classes/[classId]/students/[studentId]), so the
   * "needs attention" panel needs it to link out.
   */
  classId: string;
}

export interface TeacherOverview {
  classes: TeacherOverviewClass[];
  needsAttention: TeacherOverviewAttentionEntry[];
}

export interface StudentDetailWorldProgress {
  worldSlug: string;
  worldName: LocalizedText;
  levels: {
    levelId: string;
    slug: string;
    title: LocalizedText;
    status: ProgressState;
    stars: number;
    maxStars: number;
  }[];
}

export interface StudentDetailAttempt {
  id: string;
  levelId: string;
  levelTitle: LocalizedText;
  verdict: AttemptVerdict;
  stars: number;
  blockCount: number | null;
  hintTierUsed: number;
  durationMs: number | null;
  createdAt: Date;
}

export interface StudentDetailAchievement {
  slug: string;
  name: LocalizedText;
  icon: string;
  earnedAt: Date;
}

export interface StudentDetailCertificate {
  id: string;
  kind: string;
  serial: string;
  verifySlug: string;
  title: LocalizedText;
  issuedAt: Date;
  revoked: boolean;
}

export interface StudentDetailFeedback {
  id: string;
  body: string;
  teacherDisplayName: string;
  levelId: string;
  levelTitle: LocalizedText;
  createdAt: Date;
  readAt: Date | null;
}

export interface StudentDetail {
  studentUserId: string;
  displayName: string;
  displayUsername: string | null;
  grade: number | null;
  class: { id: string; name: string; grade: number } | null;
  xpTotal: number;
  starsTotal: number;
  streakCurrent: number;
  streakBest: number;
  lastActiveAt: string | null;
  flags: StudentFlag[];
  /**
   * What a teacher might do about those flags, most actionable first. Empty
   * when nothing is flagged — silence is the correct output for a student who
   * is fine, and inventing advice for them would train teachers to skip this.
   */
  interventions: SuggestedIntervention[];
  progress: StudentDetailWorldProgress[];
  recentAttempts: StudentDetailAttempt[];
  achievements: StudentDetailAchievement[];
  certificates: StudentDetailCertificate[];
  feedback: StudentDetailFeedback[];
}

export interface AttemptReplay {
  attempt: {
    id: string;
    levelId: string;
    levelSlug: string;
    levelTitle: LocalizedText;
    /** Extra field beyond the pinned shape — the UI needs it to decide
     * whether a Blockly/Simulation replay is even meaningful (grid types)
     * or whether to show the plain stored answer (CODE_PREDICTION/SEQUENCING). */
    activityType: string;
    /** Extra field — SimulationCanvas needs the world theme for tile tinting. */
    worldTheme: string;
    /** Extra field — the student detail route is class-scoped; null when the
     * student has no class (SCHOOL_ADMIN viewing an unassigned student). */
    classId: string | null;
    studentUserId: string;
    studentDisplayName: string;
    verdict: AttemptVerdict;
    starsEarned: number;
    xpAwarded: number;
    hintTierUsed: number;
    durationMs: number | null;
    blockCount: number | null;
    clientVerdict: string | null;
    gradeMismatch: boolean;
    createdAt: Date;
  };
  workspaceJson: unknown;
  generatedCode: string;
  /** Full (unstripped) payload — staff may see solutions. */
  levelPayload: unknown;
  /** Re-run event log per variant — empty for non-grid activity types. */
  runs: ProgramRun[];
  /** Per-variant check results from the re-run — empty for non-grid types. */
  perVariant: GradeVariantResult[];
}

// ── Shared helpers ─────────────────────────────────────────────────────────

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

/** Days back-to-back school-day walk from "now"; used by the INACTIVE flag. */
function schoolDaysAgoCutoff(now: Date, timeZone: string, weekStructure: unknown, count: number): string {
  const schoolDays = schoolDaysFrom(weekStructure);
  let cursor = localDateKey(now, timeZone);
  for (let i = 0; i < count; i += 1) {
    cursor = previousSchoolDay(cursor, schoolDays);
  }
  return cursor;
}

/**
 * School days between two date keys, walking the school's own week — "quiet
 * for 6 days" must not count a weekend a child was never expected to work.
 * Capped so a student inactive since last term reports a usable number
 * instead of spinning.
 */
const MAX_QUIET_DAYS_COUNTED = 60;

function countSchoolDaysBetween(fromKey: string, toKey: string, weekStructure: unknown): number {
  if (fromKey >= toKey) return 0;
  const schoolDays = schoolDaysFrom(weekStructure);
  let cursor = toKey;
  let days = 0;
  while (cursor > fromKey && days < MAX_QUIET_DAYS_COUNTED) {
    cursor = previousSchoolDay(cursor, schoolDays);
    days += 1;
  }
  return days;
}

/** Resolve a class row scoped by the caller's role — the isolation rule. */
async function resolveClassAccess(
  ctx: SessionContext,
  classId: string,
): Promise<{ id: string; name: string; grade: number } | null> {
  const schoolId = requireSchool(ctx);
  const cls = await db.class.findFirst({
    where: { id: classId, schoolId },
    select: { id: true, name: true, grade: true },
  });
  if (!cls) return null;

  if (ctx.role === "TEACHER") {
    const membership = await db.classMembership.findFirst({
      where: { classId, schoolId, userId: ctx.userId, role: "TEACHER" },
      select: { id: true },
    });
    if (!membership) return null;
  } else if (ctx.role !== "SCHOOL_ADMIN") {
    return null; // students / platform roles never resolve a class matrix
  }
  return cls;
}

interface LoadedLevelRow {
  matrix: MatrixLevel;
  estimatedMinutes: number;
  maxStars: number;
}

/**
 * Published levels across every program enabled for the school, in map
 * order (world → module → level), deduplicated by level id. Schools run
 * exactly one program in practice (adjudicated in M2), but the loader stays
 * robust to more than one being enabled.
 */
async function loadSchoolLevels(schoolId: string): Promise<LoadedLevelRow[]> {
  const enabled = await db.schoolProgram.findMany({
    where: { schoolId },
    select: { programId: true },
  });
  if (enabled.length === 0) return [];

  const programWorlds = await db.programWorld.findMany({
    where: {
      programId: { in: enabled.map((e) => e.programId) },
      world: { status: "PUBLISHED", horizon: false },
    },
    orderBy: [{ programId: "asc" }, { order: "asc" }],
    select: {
      world: {
        select: {
          slug: true,
          name: true,
          modules: {
            orderBy: { order: "asc" },
            select: {
              levels: {
                where: { status: "PUBLISHED", publishedVersionId: { not: null } },
                orderBy: { order: "asc" },
                select: {
                  id: true,
                  slug: true,
                  order: true,
                  title: true,
                  estimatedMinutes: true,
                  maxStars: true,
                },
              },
            },
          },
        },
      },
    },
  });

  const seen = new Set<string>();
  const rows: LoadedLevelRow[] = [];
  for (const { world } of programWorlds) {
    const worldName = asText(world.name, world.slug);
    for (const mod of world.modules) {
      for (const level of mod.levels) {
        if (seen.has(level.id)) continue;
        seen.add(level.id);
        rows.push({
          matrix: {
            id: level.id,
            slug: level.slug,
            title: asText(level.title, level.slug),
            order: level.order,
            worldSlug: world.slug,
            worldName,
          },
          estimatedMinutes: level.estimatedMinutes,
          maxStars: level.maxStars,
        });
      }
    }
  }
  return rows;
}

interface StudentAttemptFact {
  levelId: string;
  verdict: AttemptVerdict;
  durationMs: number | null;
  createdAt: Date;
}

interface FlagComputationInput {
  attempts: StudentAttemptFact[]; // NORMAL kind, desc by createdAt
  progressByLevel: Map<string, { status: ProgressState }>;
  estimatedMinutesByLevel: Map<string, number>;
  tier4LevelCount: number;
  lastActiveAt: Date | null;
  hasOpenAssignment: boolean;
  isBehindMedian: boolean;
  now: Date;
  timeZone: string;
  weekStructure: unknown;
}

/**
 * Which rows made each flag fire. The flags themselves are deliberately bare
 * enums (m4-contracts pins `StudentFlag[]`), but a teacher asking "stuck on
 * WHAT?" needs the level, and the intervention engine needs the numbers. This
 * is computed in the same pass rather than re-derived, so a suggestion can
 * never disagree with the flag that produced it.
 */
export interface FlagEvidence {
  /** Not-yet-completed level whose last three attempts all failed. */
  stuck: { levelId: string; attempts: number } | null;
  /** Level where total time ran to 3× its estimate. */
  overtime: { levelId: string; minutes: number; estimatedMinutes: number } | null;
  /** How many distinct levels needed a tier-4 hint. */
  hintHeavyLevels: number;
  /** School days since the student was last active; null = never active. */
  quietSchoolDays: number | null;
}

/**
 * The five named flag rules (m4-contracts), evaluated over real rows only.
 * Every rule is independent — a student may carry several flags at once.
 */
function computeStudentFlags(input: FlagComputationInput): StudentFlag[] {
  return computeFlagsWithEvidence(input).flags;
}

export function computeFlagsWithEvidence(input: FlagComputationInput): {
  flags: StudentFlag[];
  evidence: FlagEvidence;
} {
  const flags: StudentFlag[] = [];
  const evidence: FlagEvidence = {
    stuck: null,
    overtime: null,
    hintHeavyLevels: input.tier4LevelCount,
    quietSchoolDays: null,
  };

  // NOT_STARTED describes a learning state, not a table: a student who has
  // made progress has started, whether or not attempt rows exist for it
  // (imported/migrated progress and demo data carry progress without
  // attempts). Flagging a child who has finished eleven levels as "not
  // started" would be worse than showing no flag at all.
  const hasProgressed = [...input.progressByLevel.values()].some(
    (p) => p.status === "IN_PROGRESS" || p.status === "COMPLETED",
  );
  if (input.attempts.length === 0 && !hasProgressed) {
    flags.push("NOT_STARTED");
  }

  // STUCK: the most recent 3 attempts on a not-yet-completed level are all FAIL.
  const byLevel = new Map<string, StudentAttemptFact[]>();
  for (const attempt of input.attempts) {
    const list = byLevel.get(attempt.levelId) ?? [];
    list.push(attempt);
    byLevel.set(attempt.levelId, list);
  }
  let stuck = false;
  let overtime = false;
  for (const [levelId, list] of byLevel) {
    const status = input.progressByLevel.get(levelId)?.status;
    if (status !== "COMPLETED") {
      const lastThree = list.slice(0, 3);
      if (lastThree.length === 3 && lastThree.every((a) => a.verdict === "FAIL")) {
        stuck = true;
        // Most-attempted qualifying level wins: with several stuck levels,
        // the one they have hammered hardest is where help lands best.
        if (evidence.stuck === null || list.length > evidence.stuck.attempts) {
          evidence.stuck = { levelId, attempts: list.length };
        }
      }
    }
    const estimatedMinutes = input.estimatedMinutesByLevel.get(levelId);
    if (estimatedMinutes !== undefined) {
      const totalMs = list.reduce((sum, a) => sum + (a.durationMs ?? 0), 0);
      if (totalMs >= estimatedMinutes * 60_000 * 3) {
        overtime = true;
        const minutes = Math.round(totalMs / 60_000);
        if (evidence.overtime === null || minutes > evidence.overtime.minutes) {
          evidence.overtime = { levelId, minutes, estimatedMinutes };
        }
      }
    }
  }
  if (stuck) flags.push("STUCK");
  if (overtime) flags.push("OVERTIME");
  if (input.tier4LevelCount >= 2) flags.push("HEAVY_HINTS");

  // INACTIVE: has worked before but gone quiet for ≥5 school days, while
  // the class has open work or the student trails the class — distinguishes
  // "gone quiet" from a student who simply never started (NOT_STARTED).
  if (
    (input.attempts.length > 0 || hasProgressed) &&
    (input.hasOpenAssignment || input.isBehindMedian)
  ) {
    const cutoff = schoolDaysAgoCutoff(input.now, input.timeZone, input.weekStructure, 5);
    const lastActiveKey = input.lastActiveAt
      ? localDateKey(input.lastActiveAt, input.timeZone)
      : null;
    if (!lastActiveKey || lastActiveKey <= cutoff) {
      flags.push("INACTIVE");
      evidence.quietSchoolDays = lastActiveKey
        ? countSchoolDaysBetween(
            lastActiveKey,
            localDateKey(input.now, input.timeZone),
            input.weekStructure,
          )
        : null;
    }
  }

  return { flags, evidence };
}

interface ClassRosterStudent {
  userId: string;
  displayName: string;
  xpTotal: number;
  starsTotal: number;
  lastActiveDate: Date | null;
}

/** Core matrix builder — assumes the caller already validated access. */
async function buildClassMatrixCore(
  schoolId: string,
  classId: string,
  className: string,
  grade: number,
  now: Date,
): Promise<ClassMatrix> {
  const [roster, levelRows, school] = await Promise.all([
    db.classMembership.findMany({
      where: { classId, schoolId, role: "STUDENT" },
      select: {
        user: {
          select: {
            id: true,
            displayName: true,
            studentProfile: {
              select: { xpTotal: true, starsTotal: true, lastActiveDate: true },
            },
          },
        },
      },
      orderBy: { user: { displayName: "asc" } },
    }),
    loadSchoolLevels(schoolId),
    db.school.findUnique({ where: { id: schoolId }, select: { timezone: true, weekStructure: true } }),
  ]);

  const students: ClassRosterStudent[] = roster.map((m) => ({
    userId: m.user.id,
    displayName: m.user.displayName,
    xpTotal: m.user.studentProfile?.xpTotal ?? 0,
    starsTotal: m.user.studentProfile?.starsTotal ?? 0,
    lastActiveDate: m.user.studentProfile?.lastActiveDate ?? null,
  }));
  const studentIds = students.map((s) => s.userId);
  const levelIds = levelRows.map((r) => r.matrix.id);
  const estimatedMinutesByLevel = new Map(
    levelRows.map((r) => [r.matrix.id, r.estimatedMinutes] as const),
  );

  const [progressRows, attemptRows, hintRows, openAssignments] = await Promise.all([
    levelIds.length && studentIds.length
      ? db.studentProgress.findMany({
          where: { schoolId, levelId: { in: levelIds }, studentUserId: { in: studentIds } },
          select: { studentUserId: true, levelId: true, status: true, stars: true },
        })
      : Promise.resolve([]),
    studentIds.length
      ? db.activityAttempt.findMany({
          where: { schoolId, studentUserId: { in: studentIds }, kind: "NORMAL" },
          select: { studentUserId: true, levelId: true, verdict: true, durationMs: true, createdAt: true },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
    // Every tier, not just 4 — MatrixCell.hintTierMax reports the highest
    // tier revealed on that cell, while the HEAVY_HINTS flag separately
    // cares only about tier-4 usage (derived from this same set below).
    studentIds.length
      ? db.hintUsage.findMany({
          where: { schoolId, studentUserId: { in: studentIds } },
          select: { studentUserId: true, levelId: true, tier: true },
        })
      : Promise.resolve([]),
    db.assignment.findMany({
      where: { schoolId, classId, closedAt: null },
      select: { id: true },
    }),
  ]);

  const progressByStudent = new Map<string, Map<string, { status: ProgressState; stars: number }>>();
  for (const row of progressRows) {
    const map = progressByStudent.get(row.studentUserId) ?? new Map();
    map.set(row.levelId, { status: row.status, stars: row.stars });
    progressByStudent.set(row.studentUserId, map);
  }
  const attemptsByStudent = new Map<string, StudentAttemptFact[]>();
  const attemptCountByCell = new Map<string, number>();
  for (const row of attemptRows) {
    const list = attemptsByStudent.get(row.studentUserId) ?? [];
    list.push(row);
    attemptsByStudent.set(row.studentUserId, list);
    const cellKey = `${row.studentUserId}:${row.levelId}`;
    attemptCountByCell.set(cellKey, (attemptCountByCell.get(cellKey) ?? 0) + 1);
  }
  const hintMaxByCell = new Map<string, number>();
  const hint4LevelsByStudent = new Map<string, Set<string>>();
  for (const row of hintRows) {
    const cellKey = `${row.studentUserId}:${row.levelId}`;
    hintMaxByCell.set(cellKey, Math.max(hintMaxByCell.get(cellKey) ?? 0, row.tier));
    if (row.tier === 4) {
      const set = hint4LevelsByStudent.get(row.studentUserId) ?? new Set();
      set.add(row.levelId);
      hint4LevelsByStudent.set(row.studentUserId, set);
    }
  }

  // Median completed-level count across the roster — the "behind class" leg
  // of the INACTIVE flag. Computed from THIS class's own level set only.
  const completedCounts = students.map((s) => {
    const progress = progressByStudent.get(s.userId);
    if (!progress) return 0;
    let count = 0;
    for (const cell of progress.values()) if (cell.status === "COMPLETED") count += 1;
    return count;
  });
  const sortedCounts = [...completedCounts].sort((a, b) => a - b);
  const median =
    sortedCounts.length === 0
      ? 0
      : sortedCounts.length % 2 === 1
        ? sortedCounts[(sortedCounts.length - 1) / 2]!
        : (sortedCounts[sortedCounts.length / 2 - 1]! + sortedCounts[sortedCounts.length / 2]!) / 2;

  const timeZone = school?.timezone ?? "Asia/Dubai";
  const weekStructure = school?.weekStructure ?? null;
  const hasOpenAssignment = openAssignments.length > 0;
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  let totalCompletedCells = 0;
  let totalStarsOnCompleted = 0;
  let startedCount = 0;
  let activeThisWeek = 0;

  const matrixStudents: MatrixStudent[] = students.map((student, index) => {
    const progress = progressByStudent.get(student.userId) ?? new Map();
    const cells: Record<string, MatrixCell> = {};
    for (const levelId of levelIds) {
      const cell = progress.get(levelId);
      const status: ProgressState = cell?.status ?? "LOCKED";
      const cellKey = `${student.userId}:${levelId}`;
      if (status === "COMPLETED") {
        totalCompletedCells += 1;
        totalStarsOnCompleted += cell?.stars ?? 0;
      }
      cells[levelId] = {
        status,
        stars: cell?.stars ?? 0,
        attempts: attemptCountByCell.get(cellKey) ?? 0,
        hintTierMax: hintMaxByCell.get(cellKey) ?? 0,
      };
    }

    const attempts = attemptsByStudent.get(student.userId) ?? [];
    // "Started" follows the same learning-state rule as the NOT_STARTED flag.
    const hasProgressed = [...progress.values()].some(
      (p) => p.status === "IN_PROGRESS" || p.status === "COMPLETED",
    );
    if (attempts.length > 0 || hasProgressed) startedCount += 1;
    if (student.lastActiveDate && student.lastActiveDate >= weekAgo) activeThisWeek += 1;

    const flags = computeStudentFlags({
      attempts,
      progressByLevel: progress,
      estimatedMinutesByLevel,
      tier4LevelCount: hint4LevelsByStudent.get(student.userId)?.size ?? 0,
      lastActiveAt: student.lastActiveDate,
      hasOpenAssignment,
      isBehindMedian: completedCounts[index]! < median,
      now,
      timeZone,
      weekStructure,
    });

    return {
      userId: student.userId,
      displayName: student.displayName,
      xpTotal: student.xpTotal,
      starsTotal: student.starsTotal,
      lastActiveAt: student.lastActiveDate ? student.lastActiveDate.toISOString() : null,
      flags,
      cells,
    };
  });

  const totalCells = students.length * levelIds.length;
  const completionPct = totalCells > 0 ? Math.round((totalCompletedCells / totalCells) * 100) : 0;
  const avgStars =
    totalCompletedCells > 0
      ? Math.round((totalStarsOnCompleted / totalCompletedCells) * 10) / 10
      : 0;

  return {
    classId,
    className,
    grade,
    levels: levelRows.map((r) => r.matrix),
    students: matrixStudents,
    summary: {
      studentCount: students.length,
      startedCount,
      completionPct,
      avgStars,
      activeThisWeek,
    },
  };
}

// ── Pinned queries ─────────────────────────────────────────────────────────

export async function getClassMatrix(
  ctx: SessionContext,
  classId: string,
): Promise<ClassMatrix | null> {
  const schoolId = requireSchool(ctx);
  const cls = await resolveClassAccess(ctx, classId);
  if (!cls) return null;
  return buildClassMatrixCore(schoolId, cls.id, cls.name, cls.grade, new Date());
}

export async function getTeacherOverview(ctx: SessionContext): Promise<TeacherOverview> {
  const schoolId = requireSchool(ctx);
  // TEACHER sees the classes they teach; SCHOOL_ADMIN sees every class in
  // their own school.
  //
  // This returned an empty list for anything but TEACHER, which made the
  // whole teaching area a dead end for school admins: the nav offered them
  // "Teaching", requireRole let them in, and the page then showed the "no
  // classes yet" empty state for a school full of classes. The class detail
  // page and getClassMatrix already admit school admins (resolveClassAccess
  // grants them any class in their own school), so only the LIST that leads
  // there was missing — an oversight, not a boundary.
  //
  // Anyone else — a platform admin holding a school-scoped session, say —
  // still gets nothing rather than a school's roster by accident.
  if (ctx.role !== "TEACHER" && ctx.role !== "SCHOOL_ADMIN") {
    return { classes: [], needsAttention: [] };
  }

  const classes = await db.class.findMany({
    where:
      ctx.role === "TEACHER"
        ? { schoolId, memberships: { some: { userId: ctx.userId, role: "TEACHER", schoolId } } }
        : { schoolId },
    select: { id: true, name: true, grade: true },
    orderBy: [{ grade: "asc" }, { name: "asc" }],
  });

  const now = new Date();
  const matrices = await Promise.all(
    classes.map((cls) => buildClassMatrixCore(schoolId, cls.id, cls.name, cls.grade, now)),
  );

  const overviewClasses: TeacherOverviewClass[] = matrices.map((matrix) => ({
    id: matrix.classId,
    name: matrix.className,
    grade: matrix.grade,
    studentCount: matrix.summary.studentCount,
    completionPct: matrix.summary.completionPct,
    activeThisWeek: matrix.summary.activeThisWeek,
  }));

  const needsAttention: TeacherOverviewAttentionEntry[] = matrices.flatMap((matrix) =>
    matrix.students
      .filter((s) => s.flags.length > 0)
      .map((s) => ({
        studentUserId: s.userId,
        displayName: s.displayName,
        className: matrix.className,
        flags: s.flags,
        classId: matrix.classId,
      })),
  );

  return { classes: overviewClasses, needsAttention };
}

export interface ClassHardLevel {
  levelId: string;
  title: LocalizedText;
  worldName: LocalizedText;
  attempts: number;
  failRatePct: number;
}

/**
 * The levels this class finds hardest, by fail rate over their own runs.
 *
 * A teaching signal, not a ranking of children: it names LEVELS, and every
 * number behind it is an aggregate over the whole class. Reuses the same
 * ranking helper the school and platform dashboards use, so "hardest" means
 * the same thing at every altitude, and inherits its minimum-sample rule so
 * one unlucky run never reads as a 100% fail rate.
 */
export async function getClassHardestLevels(
  ctx: SessionContext,
  classId: string,
  limit = 3,
): Promise<ClassHardLevel[]> {
  const schoolId = requireSchool(ctx);
  const cls = await resolveClassAccess(ctx, classId);
  if (!cls) return [];

  const roster = await db.classMembership.findMany({
    where: { schoolId, classId, role: "STUDENT" },
    select: { userId: true },
  });
  if (roster.length === 0) return [];

  const stats = await computeLevelActivityStats({
    schoolId,
    studentUserId: { in: roster.map((row) => row.userId) },
  });
  // rankMostFailed returns a top-N even when nothing failed, which is right
  // for a "most failed" chart and wrong here: a level at a 0% fail rate
  // listed under "finding it hard" tells a teacher to reteach something the
  // class has already mastered.
  const ranked = rankMostFailed(stats, limit).filter((row) => row.failRatePct > 0);
  if (ranked.length === 0) return [];

  const levels = await db.level.findMany({
    where: { id: { in: ranked.map((row) => row.levelId) } },
    select: { id: true, title: true, module: { select: { world: { select: { name: true } } } } },
  });
  const byId = new Map(levels.map((level) => [level.id, level]));

  return ranked.flatMap((row) => {
    const level = byId.get(row.levelId);
    if (!level) return [];
    return [
      {
        levelId: row.levelId,
        title: localizedText.parse(level.title),
        worldName: localizedText.parse(level.module.world.name),
        attempts: row.attempts,
        failRatePct: row.failRatePct,
      },
    ];
  });
}

export async function getStudentDetail(
  ctx: SessionContext,
  studentUserId: string,
): Promise<StudentDetail | null> {
  const schoolId = requireSchool(ctx);
  if (ctx.role !== "TEACHER" && ctx.role !== "SCHOOL_ADMIN") return null;

  const student = await db.user.findFirst({
    where: { id: studentUserId, schoolId, role: "STUDENT" },
    select: {
      id: true,
      displayName: true,
      displayUsername: true,
      studentProfile: {
        select: {
          grade: true,
          xpTotal: true,
          starsTotal: true,
          streakCurrent: true,
          streakBest: true,
          lastActiveDate: true,
        },
      },
    },
  });
  if (!student) return null;

  const membership = await db.classMembership.findFirst({
    where: {
      userId: studentUserId,
      role: "STUDENT",
      schoolId,
      ...(ctx.role === "TEACHER"
        ? { class: { memberships: { some: { userId: ctx.userId, role: "TEACHER", schoolId } } } }
        : {}),
    },
    select: { class: { select: { id: true, name: true, grade: true } } },
    orderBy: { createdAt: "asc" },
  });
  // A TEACHER may only view students in one of their OWN classes; no
  // matching membership means the student is out of this teacher's scope.
  if (ctx.role === "TEACHER" && !membership) return null;

  const levelRows = await loadSchoolLevels(schoolId);
  const levelIds = levelRows.map((r) => r.matrix.id);
  const estimatedMinutesByLevel = new Map(
    levelRows.map((r) => [r.matrix.id, r.estimatedMinutes] as const),
  );

  const [progressRows, attempts, hint4Rows, achievementRows, certificateRows, feedbackRows, school] =
    await Promise.all([
      levelIds.length
        ? db.studentProgress.findMany({
            where: { schoolId, studentUserId, levelId: { in: levelIds } },
            select: { levelId: true, status: true, stars: true },
          })
        : Promise.resolve([]),
      db.activityAttempt.findMany({
        where: { schoolId, studentUserId, kind: "NORMAL" },
        select: {
          id: true,
          levelId: true,
          verdict: true,
          starsEarned: true,
          blockCount: true,
          hintTierUsed: true,
          durationMs: true,
          createdAt: true,
          level: { select: { title: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      db.hintUsage.findMany({
        where: { schoolId, studentUserId, tier: 4 },
        select: { levelId: true },
      }),
      db.studentAchievement.findMany({
        where: { schoolId, studentUserId },
        orderBy: { earnedAt: "desc" },
        select: { earnedAt: true, achievement: { select: { slug: true, name: true, icon: true } } },
      }),
      db.certificate.findMany({
        where: { schoolId, studentUserId },
        orderBy: { issuedAt: "desc" },
        select: {
          id: true,
          kind: true,
          serial: true,
          verifySlug: true,
          title: true,
          issuedAt: true,
          revokedAt: true,
        },
      }),
      db.teacherFeedback.findMany({
        where: { schoolId, studentUserId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          body: true,
          createdAt: true,
          readAt: true,
          teacher: { select: { displayName: true } },
          level: { select: { id: true, title: true } },
        },
      }),
      db.school.findUnique({ where: { id: schoolId }, select: { timezone: true, weekStructure: true } }),
    ]);

  const progressByLevel = new Map(
    progressRows.map((row) => [row.levelId, { status: row.status as ProgressState, stars: row.stars }] as const),
  );

  let hasOpenAssignment = false;
  let isBehindMedian = false;
  if (membership) {
    const [openAssignments, rosterProgress, roster] = await Promise.all([
      db.assignment.findMany({
        where: { schoolId, classId: membership.class.id, closedAt: null },
        select: { id: true },
      }),
      levelIds.length
        ? db.studentProgress.findMany({
            where: {
              schoolId,
              levelId: { in: levelIds },
              status: "COMPLETED",
              student: { classMemberships: { some: { classId: membership.class.id, schoolId, role: "STUDENT" } } },
            },
            select: { studentUserId: true },
          })
        : Promise.resolve([]),
      db.classMembership.findMany({
        where: { schoolId, classId: membership.class.id, role: "STUDENT" },
        select: { userId: true },
      }),
    ]);
    hasOpenAssignment = openAssignments.length > 0;
    // Seed every roster student at zero BEFORE counting completions. The
    // class matrix computes this median over the whole roster, and omitting
    // students who have completed nothing raises the median here — which
    // made the same student show INACTIVE on one page and not the other.
    const countByStudent = new Map<string, number>(roster.map((row) => [row.userId, 0]));
    for (const row of rosterProgress) {
      countByStudent.set(row.studentUserId, (countByStudent.get(row.studentUserId) ?? 0) + 1);
    }
    const counts = [...countByStudent.values()];
    const sorted = [...counts].sort((a, b) => a - b);
    const median =
      sorted.length === 0
        ? 0
        : sorted.length % 2 === 1
          ? sorted[(sorted.length - 1) / 2]!
          : (sorted[sorted.length / 2 - 1]! + sorted[sorted.length / 2]!) / 2;
    isBehindMedian = (countByStudent.get(studentUserId) ?? 0) < median;
  }

  const { flags, evidence } = computeFlagsWithEvidence({
    attempts,
    progressByLevel,
    estimatedMinutesByLevel,
    tier4LevelCount: new Set(hint4Rows.map((r) => r.levelId)).size,
    lastActiveAt: student.studentProfile?.lastActiveDate ?? null,
    hasOpenAssignment,
    isBehindMedian,
    now: new Date(),
    timeZone: school?.timezone ?? "Asia/Dubai",
    weekStructure: school?.weekStructure ?? null,
  });

  // Suggestions come from the same pass as the flags, so a suggestion can
  // never point at a level the flag did not actually fire on.
  const interventions = suggestInterventions({
    flags,
    evidence,
    levelTitles: new Map(levelRows.map((row) => [row.matrix.id, row.matrix.title])),
  });

  const progressByWorld = new Map<string, StudentDetailWorldProgress>();
  for (const row of levelRows) {
    const key = row.matrix.worldSlug;
    const bucket = progressByWorld.get(key) ?? { worldSlug: key, worldName: row.matrix.worldName, levels: [] };
    const cell = progressByLevel.get(row.matrix.id);
    bucket.levels.push({
      levelId: row.matrix.id,
      slug: row.matrix.slug,
      title: row.matrix.title,
      status: cell?.status ?? "LOCKED",
      stars: cell?.stars ?? 0,
      maxStars: row.maxStars,
    });
    progressByWorld.set(key, bucket);
  }

  return {
    studentUserId: student.id,
    displayName: student.displayName,
    displayUsername: student.displayUsername ?? null,
    grade: student.studentProfile?.grade ?? null,
    class: membership?.class ?? null,
    xpTotal: student.studentProfile?.xpTotal ?? 0,
    starsTotal: student.studentProfile?.starsTotal ?? 0,
    streakCurrent: student.studentProfile?.streakCurrent ?? 0,
    streakBest: student.studentProfile?.streakBest ?? 0,
    lastActiveAt: student.studentProfile?.lastActiveDate
      ? student.studentProfile.lastActiveDate.toISOString()
      : null,
    flags,
    interventions,
    progress: [...progressByWorld.values()],
    recentAttempts: attempts.slice(0, 20).map((a) => ({
      id: a.id,
      levelId: a.levelId,
      levelTitle: asText(a.level.title, ""),
      verdict: a.verdict,
      stars: a.starsEarned,
      blockCount: a.blockCount,
      hintTierUsed: a.hintTierUsed,
      durationMs: a.durationMs,
      createdAt: a.createdAt,
    })),
    achievements: achievementRows.map((row) => ({
      slug: row.achievement.slug,
      name: asText(row.achievement.name, row.achievement.slug),
      icon: row.achievement.icon,
      earnedAt: row.earnedAt,
    })),
    certificates: certificateRows.map((row) => ({
      id: row.id,
      kind: row.kind,
      serial: row.serial,
      verifySlug: row.verifySlug,
      title: asText(row.title, row.kind),
      issuedAt: row.issuedAt,
      revoked: row.revokedAt !== null,
    })),
    feedback: feedbackRows.map((row) => ({
      id: row.id,
      body: row.body,
      teacherDisplayName: row.teacher.displayName,
      levelId: row.level.id,
      levelTitle: asText(row.level.title, ""),
      createdAt: row.createdAt,
      readAt: row.readAt,
    })),
  };
}

export async function getAttemptReplay(
  ctx: SessionContext,
  attemptId: string,
): Promise<AttemptReplay | null> {
  const schoolId = requireSchool(ctx);
  if (ctx.role !== "TEACHER" && ctx.role !== "SCHOOL_ADMIN") return null;

  const attempt = await db.activityAttempt.findFirst({
    where: { id: attemptId, schoolId },
    select: {
      id: true,
      levelId: true,
      levelVersion: true,
      studentUserId: true,
      workspaceJson: true,
      verdict: true,
      starsEarned: true,
      xpAwarded: true,
      hintTierUsed: true,
      durationMs: true,
      blockCount: true,
      clientVerdict: true,
      gradeMismatch: true,
      createdAt: true,
      student: { select: { displayName: true } },
      level: { select: { slug: true, module: { select: { world: { select: { theme: true } } } } } },
    },
  });
  if (!attempt) return null;

  // Also resolves a classId for the UI's "back to student" link — a TEACHER
  // must find the student inside one of their OWN classes (access control);
  // a SCHOOL_ADMIN just needs any class membership to link back to.
  const membership = await db.classMembership.findFirst({
    where: {
      userId: attempt.studentUserId,
      role: "STUDENT",
      schoolId,
      ...(ctx.role === "TEACHER"
        ? { class: { memberships: { some: { userId: ctx.userId, role: "TEACHER", schoolId } } } }
        : {}),
    },
    select: { classId: true },
    orderBy: { createdAt: "asc" },
  });
  if (ctx.role === "TEACHER" && !membership) return null;

  const version = await db.levelVersion.findFirst({
    where: { levelId: attempt.levelId, version: attempt.levelVersion },
    select: { snapshot: true },
  });
  if (!version) return null;
  const snapshot = version.snapshot as unknown as LevelSnapshot;

  // Deterministic re-run of the STORED inputs — never re-trusts the client,
  // exactly like the original grading pipeline (m4 replay contract). Grid
  // types (BLOCK_CODING/DEBUGGING) re-run through gradeWorkspace/interpreter
  // for a real Blockly + simulation playback; CODE_PREDICTION/SEQUENCING
  // store a small answer object instead of a workspace — there is no code or
  // simulation to replay for those, so the UI falls back to a plain answer
  // review (activityType tells it which).
  const isGridType = snapshot.activityType === "BLOCK_CODING" || snapshot.activityType === "DEBUGGING";
  const grade = isGridType
    ? gradeWorkspace(snapshot, attempt.workspaceJson)
    : { generatedCode: "", runs: [] as ProgramRun[], perVariant: [] as GradeVariantResult[] };

  return {
    attempt: {
      id: attempt.id,
      levelId: attempt.levelId,
      levelSlug: attempt.level.slug,
      levelTitle: snapshot.title,
      activityType: snapshot.activityType,
      worldTheme: attempt.level.module.world.theme,
      classId: membership?.classId ?? null,
      studentUserId: attempt.studentUserId,
      studentDisplayName: attempt.student.displayName,
      verdict: attempt.verdict,
      starsEarned: attempt.starsEarned,
      xpAwarded: attempt.xpAwarded,
      hintTierUsed: attempt.hintTierUsed,
      durationMs: attempt.durationMs,
      blockCount: attempt.blockCount,
      clientVerdict: attempt.clientVerdict,
      gradeMismatch: attempt.gradeMismatch,
      createdAt: attempt.createdAt,
    },
    workspaceJson: attempt.workspaceJson,
    generatedCode: grade.generatedCode,
    levelPayload: snapshot.payload,
    runs: grade.runs,
    perVariant: grade.perVariant,
  };
}

// ── Feedback mutation (wrapped by ./actions.ts) ────────────────────────────

export interface GivenFeedback {
  id: string;
  createdAt: Date;
}

/**
 * Writes a TeacherFeedback row for a student's level. Scoped exactly like
 * getStudentDetail: a TEACHER may only write to a student in one of their
 * OWN classes; SCHOOL_ADMIN may write to any student in their school.
 */
export async function giveFeedbackCore(
  ctx: SessionContext,
  input: { studentUserId: string; levelId: string; body: string; attemptId?: string },
): Promise<GivenFeedback> {
  const schoolId = requireSchool(ctx);
  if (ctx.role !== "TEACHER" && ctx.role !== "SCHOOL_ADMIN") {
    throw new Error("Only teaching staff may leave feedback");
  }

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
  if (!student) throw new Error("Student is not in scope for this account");

  const level = await db.level.findUnique({ where: { id: input.levelId }, select: { id: true } });
  if (!level) throw new Error("Level not found");

  const created = await db.teacherFeedback.create({
    data: {
      schoolId,
      studentUserId: input.studentUserId,
      teacherUserId: ctx.userId,
      levelId: input.levelId,
      attemptId: input.attemptId,
      body: input.body,
    },
    select: { id: true, createdAt: true },
  });
  return created;
}
