import "server-only";

import { db } from "@/lib/db";
import type { SessionContext } from "@/modules/auth/server/session";

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

/** Registry walked by the tenant-isolation test suite — every query above must be here. */
export const tenantScopedQueries = {
  getMyStudentSnapshot,
} as const;
