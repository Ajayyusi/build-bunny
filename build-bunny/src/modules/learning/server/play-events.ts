import "server-only";

import { z } from "zod";

import { db } from "@/lib/db";
import { recordLearningEvent } from "@/lib/events";
import type { SessionContext } from "@/modules/auth/server/session";

import { requireProgressRow } from "./play";

/**
 * In-level analytics from the browser: a session start, an AI test that
 * isn't a graded run, a retry. Only small codes are stored — never what a
 * child typed or built.
 */
export const PLAY_TEST_KINDS = ["revealGuesses", "testRule", "computerTurn", "lockPrediction", "choice"] as const;
export const PLAY_RETRY_KINDS = ["moveLineAgain", "tryAnotherPrediction", "moreSquares", "retryRound", "tryAnother"] as const;

export const playEventSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("start") }).strict(),
  z.object({ kind: z.literal("test"), what: z.enum(PLAY_TEST_KINDS) }).strict(),
  z.object({ kind: z.literal("retry"), what: z.enum(PLAY_RETRY_KINDS) }).strict(),
]);
export type PlayEvent = z.infer<typeof playEventSchema>;

/** A reload or a quick tab switch is the same session. */
export const SESSION_GAP_MS = 30 * 60_000;

export async function recordPlayEventCore(
  ctx: SessionContext,
  levelId: string,
  event: PlayEvent,
  now = new Date(),
): Promise<{ recorded: boolean }> {
  // Same gate as every in-level call: a level this child can open.
  await requireProgressRow(ctx, levelId);
  // A platform admin viewing as the child leaves no trace in their data.
  if (ctx.impersonatedBy || !ctx.schoolId) return { recorded: false };
  const base = { schoolId: ctx.schoolId, studentUserId: ctx.userId, levelId };
  if (event.kind === "start") {
    // Check-and-insert under a per-child, per-level lock, so two starts
    // arriving together (a double mount, two tabs) record one session.
    return db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`session:${ctx.userId}:${levelId}`}))`;
      const recent = await tx.learningEvent.findFirst({
        where: {
          ...base,
          type: "LEVEL_SESSION_STARTED",
          createdAt: { gte: new Date(now.getTime() - SESSION_GAP_MS) },
        },
        select: { id: true },
      });
      if (recent) return { recorded: false };
      await tx.learningEvent.create({ data: { ...base, type: "LEVEL_SESSION_STARTED", createdAt: now } });
      return { recorded: true };
    });
  }
  await recordLearningEvent({
    ...base,
    type: event.kind === "test" ? "AI_TEST" : "AI_RETRY",
    meta: { what: event.what },
  });
  return { recorded: true };
}
