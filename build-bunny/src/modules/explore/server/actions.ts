"use server";

import { z } from "zod";

import { createRateLimiter } from "@/lib/rate-limit";
import { RateLimitedError, withAuth, type ActionResult } from "@/modules/auth/server/guard";

import { CHECK_CHOICES } from "../catalog";
import { answerConceptCheckCore } from "./checks";

const answerSchema = z.object({
  levelId: z.string().min(1),
  choice: z.enum(CHECK_CHOICES),
});

/** A child taps a few times at most; this only stops a script. */
const limiter = createRateLimiter({ limit: 30, windowMs: 60_000 });

/** The "explain it" check on the success card (student-only grant). */
export async function answerConceptCheck(input: unknown): Promise<ActionResult<{ correct: boolean }>> {
  return withAuth("attempts:submit", answerSchema, (ctx, data) => {
    if (!limiter.allow(ctx.userId)) throw new RateLimitedError("Too many answers");
    return answerConceptCheckCore(ctx, data);
  })(input);
}
