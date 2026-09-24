"use server";

import { z } from "zod";

import { createRateLimiter } from "@/lib/rate-limit";
import { RateLimitedError, withAuth, type ActionResult } from "@/modules/auth/server/guard";
import { nextStepStateSchema, type NextStep } from "@/modules/hints/server/next-step";
import {
  markLevelStartedCore,
  nextStepHintCore,
  revealHintCore,
  saveReflectionCore,
  saveWorkspaceDraftCore,
  type RevealedHint,
} from "./play";

/**
 * Player server actions (m3 contract). Thin withAuth wrappers — permission
 * check (attempts:submit is a STUDENT-only grant) + input validation, then
 * the cores in ./play.ts do the tenant-scoped work. Hint gating failures
 * surface as CONFLICT so the drawer can show "try once more" / countdown.
 */

const revealHintSchema = z.object({
  levelId: z.string().min(1),
  tier: z.number().int().min(1).max(4),
});

/**
 * Anti-hammering guard (m5 §34): revealHintCore's own tier-gating logic
 * (previous tier revealed + 60s cooldown or a fresh attempt) already limits
 * how fast hints normally advance, but nothing stopped a scripted client from
 * hammering the endpoint directly — 20/min per student is generous for a
 * human clicking "Reveal" but blocks that.
 */
const hintLimiter = createRateLimiter({ limit: 20, windowMs: 60_000 });

export async function revealHint(
  input: unknown,
): Promise<ActionResult<RevealedHint>> {
  return withAuth("attempts:submit", revealHintSchema, (ctx, data) => {
    if (!hintLimiter.allow(ctx.userId)) {
      throw new RateLimitedError("Too many hint requests");
    }
    return revealHintCore(ctx, data);
  })(input);
}

const nextStepSchema = z.object({
  levelId: z.string().min(1),
  state: nextStepStateSchema,
});

/**
 * Its own, roomier limit: a child following next steps asks once per block,
 * so a quick one on a long level can pass 20 in a minute honestly — sharing
 * the ladder's 20/min limit refused them mid-level. 60/min still stops a
 * script hammering the endpoint.
 */
const nextStepLimiter = createRateLimiter({ limit: 60, windowMs: 60_000 });

/** "Show me the next step" — see nextStepHintCore. */
export async function nextStepHint(input: unknown): Promise<ActionResult<NextStep>> {
  return withAuth("attempts:submit", nextStepSchema, (ctx, data) => {
    if (!nextStepLimiter.allow(ctx.userId)) {
      throw new RateLimitedError("Too many hint requests");
    }
    return nextStepHintCore(ctx, data);
  })(input);
}

const saveDraftSchema = z.object({
  levelId: z.string().min(1),
  workspaceJson: z.unknown(),
});

export async function saveWorkspaceDraft(
  input: unknown,
): Promise<ActionResult<{ savedAt: Date }>> {
  return withAuth("attempts:submit", saveDraftSchema, (ctx, data) =>
    saveWorkspaceDraftCore(ctx, {
      levelId: data.levelId,
      workspaceJson: data.workspaceJson ?? null,
    }),
  )(input);
}

const markStartedSchema = z.object({ levelId: z.string().min(1) });

export async function markLevelStarted(
  input: unknown,
): Promise<ActionResult<{ started: boolean }>> {
  return withAuth("attempts:submit", markStartedSchema, (ctx, data) =>
    markLevelStartedCore(ctx, data),
  )(input);
}

const reflectionSchema = z.object({
  levelId: z.string().min(1),
  feeling: z.enum(["EASY", "JUST_RIGHT", "TRICKY"]),
});

/** One-tap "How did that feel?" after a level. */
export async function saveReflection(
  input: unknown,
): Promise<ActionResult<{ feeling: "EASY" | "JUST_RIGHT" | "TRICKY" }>> {
  return withAuth("attempts:submit", reflectionSchema, (ctx, data) => saveReflectionCore(ctx, data))(input);
}
