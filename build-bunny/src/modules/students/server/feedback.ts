import "server-only";

import { db } from "@/lib/db";
import type { SessionContext } from "@/modules/auth/server/session";

/**
 * Mark teacher feedback as read.
 *
 * Server-side and idempotent: the FIRST read wins, so the timestamp answers
 * "when did this child actually see it" rather than being overwritten every
 * time they revisit the page. Scoped to the calling student, so one child can
 * never mark another's message read — and a message that was never delivered
 * to them cannot be silently acknowledged on their behalf.
 */
export async function markFeedbackRead(
  ctx: SessionContext,
  feedbackId: string,
): Promise<{ readAt: Date | null }> {
  if (!ctx.schoolId) return { readAt: null };
  const now = new Date();

  const updated = await db.teacherFeedback.updateMany({
    where: {
      id: feedbackId,
      studentUserId: ctx.userId,
      schoolId: ctx.schoolId,
      readAt: null,
    },
    data: { readAt: now },
  });
  if (updated.count > 0) return { readAt: now };

  // Already read, or not this student's to read — return the stored value
  // without disclosing which of the two it was.
  const existing = await db.teacherFeedback.findFirst({
    where: { id: feedbackId, studentUserId: ctx.userId, schoolId: ctx.schoolId },
    select: { readAt: true },
  });
  return { readAt: existing?.readAt ?? null };
}
