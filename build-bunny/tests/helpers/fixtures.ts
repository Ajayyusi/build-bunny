import { randomUUID } from "node:crypto";

import { db } from "@/lib/db";
import type { SessionContext } from "@/modules/auth/server/session";

/** Actor used when tests provision accounts outside any real session. */
export const SYSTEM_ACTOR = { userId: "system", role: "SYSTEM" } as const;

/**
 * Delete every row in FK-safe order (children before parents). Suites call
 * this in beforeAll so each file starts from a known-empty test database.
 */
export async function wipeDatabase(): Promise<void> {
  await db.learningEvent.deleteMany();
  await db.auditLog.deleteMany();
  await db.classMembership.deleteMany();
  await db.class.deleteMany();
  await db.academicYear.deleteMany();
  await db.licence.deleteMany();
  await db.studentProfile.deleteMany();
  await db.teacherProfile.deleteMany();
  await db.session.deleteMany();
  await db.account.deleteMany();
  await db.verification.deleteMany();
  await db.user.deleteMany();
  await db.school.deleteMany();
}

// Counter + UUID fragment: unique across a run AND across leftover rows from
// an interrupted previous run, while staying alphanumeric (the school code is
// embedded in student usernames, which must satisfy the username validator).
let schoolCounter = 0;

export async function createTestSchool(prefix: string) {
  schoolCounter += 1;
  const unique = `${prefix.toLowerCase()}${schoolCounter}${randomUUID().slice(0, 8)}`;
  return db.school.create({
    data: {
      name: `${prefix} Test School`,
      slug: unique,
      code: unique,
    },
  });
}

/**
 * Plain SessionContext for calling the tenant-scoped data layer directly —
 * queries trust the ctx they are given, so tests build it by hand instead of
 * going through cookies/headers.
 */
export function createCtx(overrides: Partial<SessionContext>): SessionContext {
  return {
    userId: "test-user",
    role: "SCHOOL_ADMIN",
    schoolId: null,
    displayName: "Test",
    locale: "en",
    avatarId: null,
    mustChangePassword: false,
    impersonatedBy: null,
    sessionId: "test",
    ...overrides,
  };
}
