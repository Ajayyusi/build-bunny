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

export interface SchoolDataExport {
  exportedAt: string;
  school: {
    id: string;
    name: string;
    code: string;
    slug: string;
    status: string;
    timezone: string;
  };
  teachers: {
    id: string;
    displayName: string;
    email: string;
    title: string | null;
    banned: boolean | null;
    createdAt: string;
  }[];
  students: {
    id: string;
    displayName: string;
    username: string | null;
    studentIdentifier: string;
    grade: number;
    classNames: string[];
    xpTotal: number;
    starsTotal: number;
    streakCurrent: number;
    streakBest: number;
    lastActiveDate: string | null;
    banned: boolean | null;
    createdAt: string;
  }[];
  classes: {
    id: string;
    name: string;
    grade: number;
    academicYear: string;
    studentCount: number;
  }[];
  certificates: {
    serial: string;
    kind: string;
    studentName: string;
    issuedAt: string;
    revoked: boolean;
  }[];
}

/**
 * The full "what this school's data looks like" bundle behind the school
 * trust pack / erasure-and-export requirement (plan §35, m5 §4b). Every
 * field here is also individually visible somewhere in the product to a
 * SCHOOL_ADMIN already (rosters, classes, certificates) — this just
 * consolidates it into one downloadable snapshot instead of exposing
 * anything new. verifySlug is deliberately excluded even though
 * SCHOOL_ADMIN can otherwise see certificates: it is the public/anonymous
 * lookup secret for a printed certificate, not school-administrative data,
 * and a leaked export is a more likely path to slug harvesting than the UI.
 */
export async function getSchoolDataExport(ctx: SessionContext): Promise<SchoolDataExport> {
  const schoolId = requireSchool(ctx);
  const [school, teachers, students, classes, certificates] = await Promise.all([
    db.school.findUniqueOrThrow({
      where: { id: schoolId },
      select: { id: true, name: true, code: true, slug: true, status: true, timezone: true },
    }),
    db.user.findMany({
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
    }),
    db.user.findMany({
      where: { schoolId, role: "STUDENT" },
      select: {
        id: true,
        displayName: true,
        displayUsername: true,
        banned: true,
        createdAt: true,
        studentProfile: {
          select: {
            studentIdentifier: true,
            grade: true,
            xpTotal: true,
            starsTotal: true,
            streakCurrent: true,
            streakBest: true,
            lastActiveDate: true,
          },
        },
        classMemberships: {
          where: { schoolId, role: "STUDENT" },
          select: { class: { select: { name: true } } },
        },
      },
      orderBy: { displayName: "asc" },
    }),
    db.class.findMany({
      where: { schoolId },
      select: {
        id: true,
        name: true,
        grade: true,
        academicYear: { select: { name: true } },
        _count: { select: { memberships: { where: { role: "STUDENT" } } } },
      },
      orderBy: [{ grade: "asc" }, { name: "asc" }],
    }),
    db.certificate.findMany({
      where: { schoolId },
      select: { serial: true, kind: true, studentName: true, issuedAt: true, revokedAt: true },
      orderBy: { issuedAt: "desc" },
    }),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    school,
    teachers: teachers.map((t) => ({
      id: t.id,
      displayName: t.displayName,
      email: t.email,
      title: t.teacherProfile?.title ?? null,
      banned: t.banned,
      createdAt: t.createdAt.toISOString(),
    })),
    students: students.map((s) => ({
      id: s.id,
      displayName: s.displayName,
      username: s.displayUsername,
      studentIdentifier: s.studentProfile?.studentIdentifier ?? "",
      grade: s.studentProfile?.grade ?? 0,
      classNames: s.classMemberships.map((m) => m.class.name),
      xpTotal: s.studentProfile?.xpTotal ?? 0,
      starsTotal: s.studentProfile?.starsTotal ?? 0,
      streakCurrent: s.studentProfile?.streakCurrent ?? 0,
      streakBest: s.studentProfile?.streakBest ?? 0,
      lastActiveDate: s.studentProfile?.lastActiveDate?.toISOString() ?? null,
      banned: s.banned,
      createdAt: s.createdAt.toISOString(),
    })),
    classes: classes.map((c) => ({
      id: c.id,
      name: c.name,
      grade: c.grade,
      academicYear: c.academicYear.name,
      studentCount: c._count.memberships,
    })),
    certificates: certificates.map((c) => ({
      serial: c.serial,
      kind: c.kind,
      studentName: c.studentName,
      issuedAt: c.issuedAt.toISOString(),
      revoked: c.revokedAt !== null,
    })),
  };
}

/**
 * Registry for the tenant-isolation test suite. EVERY exported query above
 * must be listed; tests iterate this and verify cross-school leakage is
 * impossible. Adding a query without registering it fails the meta-test.
 */
export type LicenceNoticeKind =
  | "EXPIRING_SOON"
  | "GRACE"
  | "READ_ONLY"
  | "SEATS_FULL"
  | "SEATS_NEARLY_FULL"
  | "NO_LICENCE";

export interface LicenceNotice {
  kind: LicenceNoticeKind;
  /** Whole days until the licence (or its grace period) runs out. */
  daysRemaining: number | null;
  seatsUsed: number;
  seatsTotal: number | null;
}

/** A school is "nearly full" from this fraction of its seats onward. */
const SEATS_WARNING_RATIO = 0.9;
/** Warn this many days before expiry — long enough to raise a purchase order. */
const EXPIRY_WARNING_DAYS = 30;

/**
 * What this school's own admin needs warning about, or null when nothing is
 * wrong.
 *
 * This exists because enforcement became real. Licence state now decides
 * access (resolveEntitlement, enforced in the session guard), so a school
 * whose licence lapses genuinely loses the product — and until now the only
 * licence information a school admin could see was a seat count with no
 * expiry date anywhere. Cutting a school off on a date nobody showed them is
 * not enforcement, it is an outage.
 *
 * Derived on read from rows that already exist: no new table, and nothing to
 * keep in sync. The trade is that it cannot say "new since you last looked" —
 * which is the honest shape here anyway, because an expiring licence does not
 * stop mattering once it has been seen.
 */
export async function getLicenceNotice(ctx: SessionContext): Promise<LicenceNotice | null> {
  const schoolId = requireSchool(ctx);
  const now = new Date();

  const [licences, seatsUsed] = await Promise.all([
    db.licence.findMany({
      where: { schoolId },
      select: { status: true, startsAt: true, expiresAt: true, graceDays: true, seats: true },
    }),
    db.user.count({ where: { schoolId, role: "STUDENT", banned: { not: true } } }),
  ]);

  const live = licences.filter(
    (licence) =>
      licence.status !== "SUSPENDED" && licence.startsAt <= now && licence.expiresAt >= now,
  );
  const seatsTotal =
    live.length > 0 ? live.reduce((total, licence) => total + licence.seats, 0) : null;

  const base = { seatsUsed, seatsTotal };

  if (licences.length === 0) return { kind: "NO_LICENCE", daysRemaining: null, ...base };

  // Seat pressure is reported only when the school still HAS a working
  // licence — telling an expired school it is nearly full buries the thing
  // that actually needs doing.
  if (live.length === 0) {
    // Past the end date: the grace window is the last useful warning.
    const latest = [...licences].sort(
      (a, b) => b.expiresAt.getTime() - a.expiresAt.getTime(),
    )[0]!;
    const graceEnds = new Date(latest.expiresAt);
    graceEnds.setDate(graceEnds.getDate() + latest.graceDays);
    if (now <= graceEnds) {
      return { kind: "GRACE", daysRemaining: daysBetween(now, graceEnds), ...base };
    }
    return { kind: "NO_LICENCE", daysRemaining: null, ...base };
  }

  if (live.some((licence) => licence.status === "READ_ONLY")) {
    return { kind: "READ_ONLY", daysRemaining: null, ...base };
  }

  // Soonest expiry among live licences — a renewal alongside an old term
  // must not hide the term that is actually about to lapse.
  const soonest = [...live].sort((a, b) => a.expiresAt.getTime() - b.expiresAt.getTime())[0]!;
  const daysRemaining = daysBetween(now, soonest.expiresAt);
  if (daysRemaining <= EXPIRY_WARNING_DAYS) {
    return { kind: "EXPIRING_SOON", daysRemaining, ...base };
  }

  if (seatsTotal !== null) {
    if (seatsUsed >= seatsTotal) {
      return { kind: "SEATS_FULL", daysRemaining: null, ...base };
    }
    if (seatsUsed >= Math.floor(seatsTotal * SEATS_WARNING_RATIO)) {
      return { kind: "SEATS_NEARLY_FULL", daysRemaining: null, ...base };
    }
  }

  return null;
}

/** Whole days from `from` to `to`, never negative. */
function daysBetween(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

export const tenantScopedQueries = {
  getSchoolSummary,
  getLicenceNotice,
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
  getSchoolDataExport,
} as const;
