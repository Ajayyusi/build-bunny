import "server-only";

import { z } from "zod";

import { NotFoundError } from "@/modules/auth/server/guard";
import type { SessionContext } from "@/modules/auth/server/session";
import { aiSimPayload } from "@/modules/curriculum/schemas";
import { getPublishedLevelSnapshot } from "@/modules/curriculum/server/queries";
import { requireProgressRow } from "@/modules/learning/server/play";

import { judgePixelRound } from "./judge";
import type { PixelRoundCheckResult } from "./types";

export const pixelRoundCheckSchema = z
  .object({
    roundId: z.string().min(1).max(64),
    imageId: z.string().min(1).max(64),
    resolution: z.number().int().min(1).max(512),
  })
  .strict();
export type PixelRoundCheckInput = z.infer<typeof pixelRoundCheckSchema>;

/**
 * See Like a Computer: check ONE mystery round's guess, mid-level. The
 * answer key (each round's imageId) never reaches the browser, so the
 * per-round reveal has to come from here. Same gate as every in-level call
 * (progress row + entitlement); it grades nothing and records nothing — the
 * level's graded attempt still re-checks every round.
 */
export async function checkPixelRoundCore(
  ctx: SessionContext,
  levelId: string,
  input: PixelRoundCheckInput,
): Promise<PixelRoundCheckResult> {
  await requireProgressRow(ctx, levelId);
  const published = await getPublishedLevelSnapshot(levelId);
  if (!published || published.snapshot.activityType !== "AI_SIM") throw new NotFoundError("Level not found");
  const payload = aiSimPayload.safeParse(published.snapshot.payload);
  if (!payload.success || payload.data.widget.widgetId !== "pixel-playground") {
    throw new NotFoundError("Level not found");
  }
  const result = judgePixelRound(payload.data.widget, input);
  if (!result) throw new NotFoundError("Round not found");
  return result;
}
