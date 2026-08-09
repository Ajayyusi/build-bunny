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
