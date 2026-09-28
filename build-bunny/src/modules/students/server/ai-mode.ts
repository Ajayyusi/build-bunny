import "server-only";

import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { NotFoundError } from "@/modules/auth/server/guard";
import type { SessionContext } from "@/modules/auth/server/session";

import { storedFor, type AiModeChoice } from "../ai-mode";

/**
 * Switch a child's AI mode. Only StudentProfile.aiMode changes: progress,
 * stars and drafts are untouched (handoff: switch without resetting
 * progress).
 */

/** The child's own switch on Explore AI. */
export async function setMyAiModeCore(ctx: SessionContext, choice: AiModeChoice): Promise<{ choice: AiModeChoice }> {
  if (ctx.role !== "STUDENT" || !ctx.schoolId) throw new NotFoundError("Not a student");
  // A platform admin viewing as the child doesn't change their settings.
  if (ctx.impersonatedBy) return { choice };
  const updated = await db.studentProfile.updateMany({
    where: { userId: ctx.userId, schoolId: ctx.schoolId },
    data: { aiMode: storedFor(choice) },
  });
  if (updated.count === 0) throw new NotFoundError("No student profile");
  return { choice };
}

/**
 * A teacher (for a child in one of their classes) or the school admin (any
 * child in the school) sets the mode. Same scope rule as teacher feedback.
 */
export async function setStudentAiModeCore(
  ctx: SessionContext,
  input: { studentUserId: string; choice: AiModeChoice },
): Promise<{ choice: AiModeChoice }> {
  const schoolId = ctx.schoolId;
  if (!schoolId || (ctx.role !== "TEACHER" && ctx.role !== "SCHOOL_ADMIN")) throw new NotFoundError("Not staff");
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
  if (!student) throw new NotFoundError("Student is not in scope for this account");
  await db.studentProfile.update({ where: { userId: student.id }, data: { aiMode: storedFor(input.choice) } });
  await audit({
    action: "student.ai_mode_set",
    actorUserId: ctx.userId,
    actorRole: ctx.role,
    schoolId,
    targetType: "student",
    targetId: student.id,
    meta: { choice: input.choice },
  });
  return { choice: input.choice };
}
