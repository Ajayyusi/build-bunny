import "server-only";

import { z } from "zod";

import { aiClassificationAnswerSchema } from "@/modules/activities/server/ai-classification";
import { aiEthicsAnswerSchema } from "@/modules/activities/server/ai-ethics";
import { aiSimAnswerSchema } from "@/modules/activities/server/ai-sim";
import { patternRecognitionAnswerSchema } from "@/modules/activities/server/pattern-recognition";
import { gridVariantSchema } from "@/modules/curriculum/schemas";

import type { AttemptInput } from "./submit";

/**
 * The attempts route's request body, per level type — moved out of the
 * route so the playthrough tests can push every level's winning answer
 * through EXACTLY the parse the HTTP route does. The Fortune Teller bug
 * (a union that stripped `prediction`) lived here, in the one layer no test
 * exercised: the playthrough called submitAttempt directly.
 *
 * The body is a discriminated union on the level's activityType (m4 task 4):
 * grid types (BLOCK_CODING/DEBUGGING) send the raw workspace; CODE_PREDICTION
 * sends `{ answer: { optionId } }`; SEQUENCING sends `{ answer: { order } }`;
 * CONCEPT_CARDS sends `{ answer: { blockType } }`. .strict() on every branch
 * means a body shaped for one type is rejected — not silently accepted —
 * when sent against a level of another type.
 */

const gridBodySchema = z
  .object({
    attemptRunId: z.string().uuid(),
    workspaceJson: z.unknown(),
    clientVerdict: z.enum(["PASS", "PARTIAL", "FAIL"]).optional(),
    durationMs: z.number().int().nonnegative().optional(),
  })
  .strict();

/** CREATIVE_PROJECT (build-your-own maze): the program AND the child's design. */
const creativeProjectBodySchema = gridBodySchema.extend({ design: gridVariantSchema }).strict();

const answerBody = <T extends z.ZodTypeAny>(answer: T) =>
  z.object({ attemptRunId: z.string().uuid(), answer }).strict();

/**
 * The answer halves are imported, never re-typed: these shapes existed as
 * hand-maintained copies, and adding a field to only some of them is exactly
 * the bug that once made every submission a silent 400.
 */
const ANSWER_BODIES: Record<string, z.ZodTypeAny> = {
  CODE_PREDICTION: answerBody(z.object({ optionId: z.string().min(1) }).strict()),
  SEQUENCING: answerBody(z.object({ order: z.array(z.string().min(1)).min(1) }).strict()),
  CONCEPT_CARDS: answerBody(z.object({ blockType: z.string().min(1) }).strict()),
  AI_CLASSIFICATION: answerBody(aiClassificationAnswerSchema),
  PATTERN_RECOGNITION: answerBody(patternRecognitionAnswerSchema),
  AI_ETHICS: answerBody(aiEthicsAnswerSchema),
  // AI_SIM answers differ per widget (line/prediction/rounds); the union is
  // .strict() per branch, and the engine adapter re-validates against the
  // level's OWN widget schema before grading.
  AI_SIM: answerBody(aiSimAnswerSchema),
};

const GRID_ACTIVITY_TYPES = new Set(["BLOCK_CODING", "DEBUGGING"]);

export type ParsedAttemptBody =
  | { ok: true; input: AttemptInput }
  | { ok: false; issues?: Record<string, string[] | undefined> };

/**
 * Validate a raw request body for a level of `activityType` (undefined =
 * unknown/locked level: parsed leniently as a grid body, then refused as
 * LOCKED by submitAttempt).
 */
export function parseAttemptBody(activityType: string | undefined, raw: unknown): ParsedAttemptBody {
  if (activityType && ANSWER_BODIES[activityType]) {
    const parsed = ANSWER_BODIES[activityType]!.safeParse(raw);
    return parsed.success
      ? { ok: true, input: parsed.data as AttemptInput }
      : { ok: false, issues: parsed.error.flatten().fieldErrors };
  }
  if (activityType === "CREATIVE_PROJECT") {
    const parsed = creativeProjectBodySchema.safeParse(raw);
    return parsed.success
      ? { ok: true, input: { ...parsed.data, workspaceJson: parsed.data.workspaceJson ?? null } }
      : { ok: false, issues: parsed.error.flatten().fieldErrors };
  }
  if (!activityType || GRID_ACTIVITY_TYPES.has(activityType)) {
    const parsed = gridBodySchema.safeParse(raw);
    return parsed.success
      ? { ok: true, input: { ...parsed.data, workspaceJson: parsed.data.workspaceJson ?? null } }
      : { ok: false, issues: parsed.error.flatten().fieldErrors };
  }
  // A registered ActivityType with no V1 engine yet (e.g. QUIZ): no body shape is valid.
  return { ok: false };
}
