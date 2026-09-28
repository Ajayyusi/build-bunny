"use server";

import { z } from "zod";

import { createRateLimiter } from "@/lib/rate-limit";
import { RateLimitedError, withAuth, type ActionResult } from "@/modules/auth/server/guard";

import { CHECK_CHOICES } from "../catalog";
import { answerConceptCheckCore } from "./checks";
import { saveExplanationCore, setConceptObservedCore } from "./explanations";
import { AI_CONCEPTS } from "@/modules/analytics/ai-concepts";

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

/** "Say it your way": phrase ids for a finished level (attempts:submit). */
export async function saveExplanation(raw: unknown): Promise<ActionResult<{ saved: boolean }>> {
  return withAuth(
    "attempts:submit",
    z.object({ levelId: z.string().min(1), parts: z.array(z.string().min(1).max(40)).length(3) }),
    (ctx, data) => saveExplanationCore(ctx, data),
  )(raw);
}

/** A teacher's "heard them explain it aloud" tick (attempts:feedback). */
export async function setConceptObserved(raw: unknown): Promise<ActionResult<{ observed: boolean }>> {
  return withAuth(
    "attempts:feedback",
    z.object({
      studentUserId: z.string().min(1),
      concept: z.enum(AI_CONCEPTS),
      observed: z.boolean(),
    }),
    (ctx, data) => setConceptObservedCore(ctx, data),
  )(raw);
}

