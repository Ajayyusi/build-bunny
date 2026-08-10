"use server";

import { z } from "zod";

import { createRateLimiter } from "@/lib/rate-limit";
import { RateLimitedError, withAuth, type ActionResult } from "@/modules/auth/server/guard";
import {
  markLevelStartedCore,
  revealHintCore,
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
