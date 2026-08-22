"use server";

import { z } from "zod";

import { withAuth, type ActionResult } from "@/modules/auth/server/guard";
import { markFeedbackRead } from "@/modules/students/server/feedback";

const input = z.object({ feedbackId: z.string().min(1) });

/**
 * Runs under curriculum:read — the read permission students already hold.
 * Marking a message read is not a product write in the licensing sense, and
 * a READ_ONLY school's pupils must still be able to open something their
 * teacher already sent them.
 */
export async function markFeedbackReadAction(
  raw: unknown,
): Promise<ActionResult<{ readAt: Date | null }>> {
  return withAuth("curriculum:read", input, (ctx, { feedbackId }) =>
    markFeedbackRead(ctx, feedbackId),
  )(raw);
}
