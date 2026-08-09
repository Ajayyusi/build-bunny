"use server";

import { z } from "zod";

import { withAuth, type ActionResult } from "@/modules/auth/server/guard";
import { giveFeedbackCore, type GivenFeedback } from "./teacher";

/**
 * Teacher feedback composer action (m4 deliverable 4). withAuth checks
 * attempts:feedback (TEACHER + SCHOOL_ADMIN grant it); giveFeedbackCore
 * re-validates the student is actually in the caller's scope.
 */
const giveFeedbackSchema = z.object({
  studentUserId: z.string().min(1),
  levelId: z.string().min(1),
  body: z.string().trim().min(1).max(2000),
  attemptId: z.string().min(1).optional(),
});

export async function giveFeedback(
  input: unknown,
): Promise<ActionResult<GivenFeedback>> {
  return withAuth("attempts:feedback", giveFeedbackSchema, (ctx, data) =>
    giveFeedbackCore(ctx, data),
  )(input);
}
