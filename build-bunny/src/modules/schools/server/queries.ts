import "server-only";

import { db } from "@/lib/db";
import { AUDIT } from "@/lib/audit";
import type { SessionContext } from "@/modules/auth/server/session";

/**
 * Tenant-scoped school-domain queries (plan §1.2). RULES:
 *  1. Every function takes the SessionContext FIRST and derives schoolId from
 *     it — never from caller-supplied input.
 *  2. Every lookup by id is a COMPOUND lookup (id + schoolId) so a guessed or
 *     tampered id from another school resolves to nothing.
 *  3. Every exported function must appear in `tenantScopedQueries` at the
 *     bottom — the isolation test suite walks that registry and fails CI if a
 *     query is missing coverage.
 */

function requireSchool(ctx: SessionContext): string {
  if (!ctx.schoolId) {
    throw new Error("This operation requires a school-scoped session");
  }
  return ctx.schoolId;
}

export async function getSchoolSummary(ctx: SessionContext) {
  const schoolId = requireSchool(ctx);
  const [school, teachers, students, classes] = await Promise.all([
    db.school.findUnique({
      where: { id: schoolId },
      select: {
        id: true,
        name: true,
        code: true,
        status: true,
        timezone: true,
        defaultLocale: true,
        features: true,
      },
    }),
    db.teacherProfile.count({ where: { schoolId } }),
    db.studentProfile.count({ where: { schoolId } }),
    db.class.count({ where: { schoolId } }),
  ]);
  if (!school) return null;
  return { ...school, counts: { teachers, students, classes } };
}

export async function listTeachers(ctx: SessionContext) {
  const schoolId = requireSchool(ctx);
  return db.user.findMany({
    where: { schoolId, role: "TEACHER" },
    select: {
      id: true,
      displayName: true,
      email: true,
      banned: true,
      createdAt: true,
      teacherProfile: { select: { title: true } },
    },
    orderBy: { displayName: "asc" },
  });
}

export async function listStudents(
  ctx: SessionContext,
  filter?: {
    classId?: string;
    grade?: number;
    /** Matches display name, username or student identifier (case-insensitive). */
    search?: string;
    status?: "active" | "disabled";
  },
) {
  const schoolId = requireSchool(ctx);
  const search = filter?.search?.trim();
  return db.user.findMany({
    where: {
      schoolId,
      role: "STUDENT",
      ...(filter?.grade !== undefined
        ? { studentProfile: { grade: filter.grade } }
        : {}),
      ...(filter?.classId
        ? {
            classMemberships: {
              some: { classId: filter.classId, schoolId },
            },
          }
        : {}),
      ...(filter?.status === "active" ? { banned: { not: true } } : {}),
      ...(filter?.status === "disabled" ? { banned: true } : {}),
      ...(search
        ? {
            OR: [
              { displayName: { contains: search, mode: "insensitive" } },
              { displayUsername: { contains: search, mode: "insensitive" } },
              {
                studentProfile: {
                  studentIdentifier: { contains: search, mode: "insensitive" },
                },
              },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      displayName: true,
      displayUsername: true,
      banned: true,
      studentProfile: {
        select: {
          studentIdentifier: true,
          grade: true,
          xpTotal: true,
          starsTotal: true,
          streakCurrent: true,
          lastActiveDate: true,
        },
      },
      classMemberships: {
        where: { schoolId, role: "STUDENT" },
        select: { class: { select: { id: true, name: true } } },
      },
    },
    orderBy: { displayName: "asc" },
  });
}

export async function getStudentDetail(ctx: SessionContext, studentUserId: string) {
  const schoolId = requireSchool(ctx);
  // Compound lookup: a foreign id yields null, never data.
  return db.user.findFirst({
    where: { id: studentUserId, schoolId, role: "STUDENT" },
    select: {
      id: true,
      displayName: true,
      displayUsername: true,
      banned: true,
      locale: true,
      createdAt: true,
      studentProfile: true,
      classMemberships: {
        where: { schoolId },
        select: { class: { select: { id: true, name: true, grade: true } } },
      },
    },
  });
}

export async function listClasses(ctx: SessionContext) {
  const schoolId = requireSchool(ctx);
  return db.class.findMany({
    where: { schoolId },
    select: {
      id: true,
      name: true,
      grade: true,
      joinCode: true,
      academicYear: { select: { id: true, name: true, isActive: true } },
      _count: { select: { memberships: { where: { role: "STUDENT" } } } },
    },
    orderBy: [{ grade: "asc" }, { name: "asc" }],
  });
}

export async function getClassDetail(ctx: SessionContext, classId: string) {
  const schoolId = requireSchool(ctx);
  return db.class.findFirst({
    where: { id: classId, schoolId },
    select: {
      id: true,
      name: true,
      grade: true,
      joinCode: true,
      academicYear: { select: { name: true } },
      memberships: {
        select: {
          role: true,
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
      },
    },
  });
}

/** Classes taught by the calling teacher (their own only). */
export async function listMyClasses(ctx: SessionContext) {
  const schoolId = requireSchool(ctx);
  return db.class.findMany({
    where: {
      schoolId,
      memberships: { some: { userId: ctx.userId, role: "TEACHER", schoolId } },
    },
    select: {
      id: true,
      name: true,
      grade: true,
      _count: { select: { memberships: { where: { role: "STUDENT" } } } },
    },
    orderBy: [{ grade: "asc" }, { name: "asc" }],
  });
}

export async function listSchoolAuditLogs(ctx: SessionContext, limit = 50) {
  const schoolId = requireSchool(ctx);
  return db.auditLog.findMany({
    where: { schoolId },
    orderBy: { createdAt: "desc" },
    take: Math.min(limit, 200),
  });
}

/** Academic years for the class create/edit form, most recent first. */
export async function listAcademicYears(ctx: SessionContext) {
  const schoolId = requireSchool(ctx);
  return db.academicYear.findMany({
    where: { schoolId },
    orderBy: [{ isActive: "desc" }, { startsAt: "desc" }],
  });
}

/**
 * Recent CSV-import runs for this school, read from the audit trail (there is
 * no separate import-batch table — the audit entry IS the record, with
 * created/updated/error counts in its meta).
 */
export async function listImportHistory(ctx: SessionContext, limit = 20) {
  const schoolId = requireSchool(ctx);
  return db.auditLog.findMany({
    where: { schoolId, action: AUDIT.students.imported },
    orderBy: { createdAt: "desc" },
    take: Math.min(limit, 100),
  });
}

export interface StudentProgressReportRow {
  studentId: string;
  displayName: string;
  username: string | null;
  studentIdentifier: string;
  className: string | null;
  grade: number;
  xpTotal: number;
  starsTotal: number;
  streakCurrent: number;
  levelsCompleted: number;
  lastActiveDate: Date | null;
}

/** One row per student — the source data for the /school/reports CSV export. */
export async function getSchoolProgressReport(
  ctx: SessionContext,
): Promise<StudentProgressReportRow[]> {
  const schoolId = requireSchool(ctx);
  const [students, completions] = await Promise.all([
    db.user.findMany({
      where: { schoolId, role: "STUDENT" },
      select: {
        id: true,
        displayName: true,
        displayUsername: true,
        studentProfile: {
          select: {
            studentIdentifier: true,
            grade: true,
            xpTotal: true,
            starsTotal: true,
            streakCurrent: true,
            lastActiveDate: true,
          },
        },
        classMemberships: {
          where: { schoolId, role: "STUDENT" },
          take: 1,
          select: { class: { select: { name: true } } },
        },
      },
      orderBy: { displayName: "asc" },
    }),
    db.studentProgress.groupBy({
      by: ["studentUserId"],
      where: { schoolId, status: "COMPLETED" },
      _count: { _all: true },
    }),
  ]);
  const completedByStudent = new Map(
    completions.map((c) => [c.studentUserId, c._count._all]),
  );
  return students.map((s) => ({
    studentId: s.id,
    displayName: s.displayName,
    username: s.displayUsername,
    studentIdentifier: s.studentProfile?.studentIdentifier ?? "",
    className: s.classMemberships[0]?.class.name ?? null,
    grade: s.studentProfile?.grade ?? 0,
    xpTotal: s.studentProfile?.xpTotal ?? 0,
    starsTotal: s.studentProfile?.starsTotal ?? 0,
    streakCurrent: s.studentProfile?.streakCurrent ?? 0,
    levelsCompleted: completedByStudent.get(s.id) ?? 0,
    lastActiveDate: s.studentProfile?.lastActiveDate ?? null,
  }));
}

/**
 * Registry for the tenant-isolation test suite. EVERY exported query above
 * must be listed; tests iterate this and verify cross-school leakage is
 * impossible. Adding a query without registering it fails the meta-test.
 */
export const tenantScopedQueries = {
  getSchoolSummary,
  listTeachers,
  listStudents,
  getStudentDetail,
  listClasses,
  getClassDetail,
  listMyClasses,
  listSchoolAuditLogs,
  listAcademicYears,
  listImportHistory,
  getSchoolProgressReport,
} as const;
