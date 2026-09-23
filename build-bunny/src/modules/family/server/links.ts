import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import type { SessionContext } from "@/modules/auth/server/session";
import { NotFoundError } from "@/modules/auth/server/guard";
import { AuthError } from "@/modules/auth/server/session";

/**
 * Family links (brief §6): a teacher shares a private, read-only view of one
 * child's progress with that child's family. No parent accounts and no
 * logins — the link IS the credential, so:
 *  - the token is 32 random bytes, and only its SHA-256 hash is stored;
 *    the full link is returned once, at creation, and never again;
 *  - a link expires after 90 days and can be revoked at any time;
 *  - a child has at most one live link: creating a new one revokes the old,
 *    so "I sent it to the wrong person" is fixed with one click.
 * Every create and revoke is audited.
 */

export const FAMILY_LINK_DAYS = 90;

export function hashFamilyToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * The staff member may act for this child: a SCHOOL_ADMIN for any student
 * in their school, a TEACHER only for a student in one of their own classes
 * (the same rule as the student detail page).
 */
async function assertStudentAccess(ctx: SessionContext, studentUserId: string): Promise<string> {
  const schoolId = ctx.schoolId;
  if (!schoolId || (ctx.role !== "TEACHER" && ctx.role !== "SCHOOL_ADMIN")) {
    throw new NotFoundError("Student not found");
  }
  const student = await db.user.findFirst({
    where: { id: studentUserId, schoolId, role: "STUDENT" },
    select: { id: true },
  });
  if (!student) throw new NotFoundError("Student not found");
  if (ctx.role === "TEACHER") {
    const membership = await db.classMembership.findFirst({
      where: {
        userId: studentUserId,
        role: "STUDENT",
        schoolId,
        class: { memberships: { some: { userId: ctx.userId, role: "TEACHER", schoolId } } },
      },
      select: { id: true },
    });
    if (!membership) throw new NotFoundError("Student not found");
  }
  return schoolId;
}

export interface FamilyLinkStatus {
  active: boolean;
  createdAt: Date | null;
  expiresAt: Date | null;
  lastViewedAt: Date | null;
}

/** Whether this child has a live link (never the link itself — it is not stored). */
export async function getFamilyLinkStatus(
  ctx: SessionContext,
  studentUserId: string,
): Promise<FamilyLinkStatus | null> {
  let schoolId: string;
  try {
    schoolId = await assertStudentAccess(ctx, studentUserId);
  } catch {
    return null;
  }
  const link = await db.familyLink.findFirst({
    where: { schoolId, studentUserId, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true, expiresAt: true, lastViewedAt: true },
  });
  return link
    ? { active: true, createdAt: link.createdAt, expiresAt: link.expiresAt, lastViewedAt: link.lastViewedAt }
    : { active: false, createdAt: null, expiresAt: null, lastViewedAt: null };
}

export async function createFamilyLinkCore(
  ctx: SessionContext,
  input: { studentUserId: string },
): Promise<{ token: string; expiresAt: Date }> {
  // A link outlives the session that made it; one made while a platform
  // admin is viewing as a teacher would be attributed to the teacher.
  if (ctx.impersonatedBy) throw new AuthError("FORBIDDEN");
  const schoolId = await assertStudentAccess(ctx, input.studentUserId);
  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + FAMILY_LINK_DAYS * 24 * 60 * 60 * 1000);
  await db.$transaction([
    db.familyLink.updateMany({
      where: { schoolId, studentUserId: input.studentUserId, revokedAt: null },
      data: { revokedAt: now },
    }),
    db.familyLink.create({
      data: {
        schoolId,
        studentUserId: input.studentUserId,
        createdById: ctx.userId,
        tokenHash: hashFamilyToken(token),
        expiresAt,
      },
    }),
  ]);
  await audit({
    action: "family_link.create",
    actorUserId: ctx.userId,
    actorRole: ctx.role,
    schoolId,
    targetType: "User",
    targetId: input.studentUserId,
  });
  return { token, expiresAt };
}

export async function revokeFamilyLinksCore(
  ctx: SessionContext,
  input: { studentUserId: string },
): Promise<{ revoked: number }> {
  const schoolId = await assertStudentAccess(ctx, input.studentUserId);
  const result = await db.familyLink.updateMany({
    where: { schoolId, studentUserId: input.studentUserId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  await audit({
    action: "family_link.revoke",
    actorUserId: ctx.userId,
    actorRole: ctx.role,
    schoolId,
    targetType: "User",
    targetId: input.studentUserId,
    meta: { revoked: result.count },
  });
  return { revoked: result.count };
}
