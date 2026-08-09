import "server-only";

import { db } from "@/lib/db";
import type { SessionContext } from "@/modules/auth/server/session";

/**
 * Platform-wide queries — NITAQ/SUPER admins only. These are the only
 * queries allowed to read across schools; the guard is re-checked here
 * (defense in depth, never rely on the route alone).
 */
function requirePlatform(ctx: SessionContext): void {
  if (ctx.role !== "SUPER_ADMIN" && ctx.role !== "NITAQ_ADMIN") {
    throw new Error("Platform-only query invoked with a non-platform session");
  }
}

export async function getPlatformOverview(ctx: SessionContext) {
  requirePlatform(ctx);
  const [schools, activeSchools, students, teachers, licencesExpiringSoon] =
    await Promise.all([
      db.school.count(),
      db.school.count({ where: { status: "ACTIVE" } }),
      db.studentProfile.count(),
      db.teacherProfile.count(),
      db.licence.count({
        where: {
          status: { in: ["ACTIVE", "GRACE"] },
          expiresAt: { lte: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000) },
        },
      }),
    ]);
  return { schools, activeSchools, students, teachers, licencesExpiringSoon };
}

export async function listSchools(ctx: SessionContext) {
  requirePlatform(ctx);
  return db.school.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      code: true,
      status: true,
      createdAt: true,
      _count: { select: { studentProfiles: true, teacherProfiles: true } },
      licences: {
        select: { status: true, seats: true, expiresAt: true },
        orderBy: { expiresAt: "desc" },
        take: 1,
      },
    },
    orderBy: { name: "asc" },
  });
}

export async function listPlatformAuditLogs(ctx: SessionContext, limit = 100) {
  requirePlatform(ctx);
  return db.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: Math.min(limit, 500),
  });
}

export interface SchoolDetail {
  id: string;
  name: string;
  slug: string;
  code: string;
  status: "ACTIVE" | "INACTIVE";
  timezone: string;
  createdAt: Date;
  counts: { teachers: number; students: number; classes: number };
  licences: {
    id: string;
    seats: number;
    startsAt: Date;
    expiresAt: Date;
    status: string;
    notes: string | null;
  }[];
  admins: { id: string; displayName: string; email: string; banned: boolean | null }[];
}

/** Full overview for /nitaq/schools/[schoolId] — any school, platform staff only. */
export async function getSchoolDetail(
  ctx: SessionContext,
  schoolId: string,
): Promise<SchoolDetail | null> {
  requirePlatform(ctx);
  const school = await db.school.findUnique({
    where: { id: schoolId },
    select: {
      id: true,
      name: true,
      slug: true,
      code: true,
      status: true,
      timezone: true,
      createdAt: true,
      licences: { orderBy: { expiresAt: "desc" } },
      users: {
        where: { role: "SCHOOL_ADMIN" },
        select: { id: true, displayName: true, email: true, banned: true },
        orderBy: { displayName: "asc" },
      },
      _count: { select: { teacherProfiles: true, studentProfiles: true, classes: true } },
    },
  });
  if (!school) return null;
  return {
    id: school.id,
    name: school.name,
    slug: school.slug,
    code: school.code,
    status: school.status,
    timezone: school.timezone,
    createdAt: school.createdAt,
    counts: {
      teachers: school._count.teacherProfiles,
      students: school._count.studentProfiles,
      classes: school._count.classes,
    },
    licences: school.licences,
    admins: school.users,
  };
}

export interface PlatformUserResult {
  id: string;
  displayName: string;
  email: string;
  displayUsername: string | null;
  role: string;
  banned: boolean | null;
  schoolId: string | null;
  schoolName: string | null;
}

/** Cross-tenant account directory for /nitaq/users — search only, no listing-everyone. */
export async function searchUsers(
  ctx: SessionContext,
  query: string,
): Promise<PlatformUserResult[]> {
  requirePlatform(ctx);
  const q = query.trim();
  if (q.length < 2) return [];
  const users = await db.user.findMany({
    where: {
      OR: [
        { displayName: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { displayUsername: { contains: q, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      displayName: true,
      email: true,
      displayUsername: true,
      role: true,
      banned: true,
      schoolId: true,
      school: { select: { name: true } },
    },
    orderBy: { displayName: "asc" },
    take: 50,
  });
  return users.map((u) => ({
    id: u.id,
    displayName: u.displayName,
    email: u.email,
    displayUsername: u.displayUsername,
    role: u.role,
    banned: u.banned,
    schoolId: u.schoolId,
    schoolName: u.school?.name ?? null,
  }));
}

export interface AuditLogFilter {
  actorUserId?: string;
  action?: string;
  schoolId?: string;
  from?: Date;
  to?: Date;
  limit?: number;
}

/** Filterable audit trail for /nitaq/audit-log. */
export async function searchPlatformAuditLogs(ctx: SessionContext, filter: AuditLogFilter = {}) {
  requirePlatform(ctx);
  return db.auditLog.findMany({
    where: {
      ...(filter.actorUserId ? { actorUserId: filter.actorUserId } : {}),
      ...(filter.action ? { action: { contains: filter.action, mode: "insensitive" } } : {}),
      ...(filter.schoolId ? { schoolId: filter.schoolId } : {}),
      ...(filter.from || filter.to
        ? {
            createdAt: {
              ...(filter.from ? { gte: filter.from } : {}),
              ...(filter.to ? { lte: filter.to } : {}),
            },
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(filter.limit ?? 100, 500),
  });
}
