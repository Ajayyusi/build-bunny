import "server-only";

import { z } from "zod";

import {
  blockRefSchema,
  conceptCardsPayload,
  gridVariantSchema,
  localizedText,
} from "@/modules/curriculum/schemas";
import type { LevelSnapshot } from "@/modules/curriculum/server/publish";
import type { ActivityGradeResult } from "../types";

/**
 * CONCEPT_CARDS engine — the Learn step (docs/build-bunny/LEARN-STEP-SPEC.md).
 * The student watches a worked example run, then fills the single gap in a
 * faded copy of it; grading is a straight comparison against
 * faded.missingBlockType, which never leaves the server.
 *
 * A Learn step is NOT a test, so grading is pass-on-completion: the right
 * block PASSES with qualityPassed (the level's own maxStars of 0 is what
 * keeps the reward at zero stars — see submit.ts's clamp), and a wrong block
 * returns the gentle `tryAnotherBlock` feedback the player re-prompts with
 * inline. FAIL is the only enum value that means "not completed yet"; nothing
 * downstream punishes it here, because there are no stars to lose and no XP
 * is awarded until the level completes.
 */

/**
 * Answer-free mirror of conceptCardsPayload (curriculum/schemas.ts).
 * faded.missingBlockType is REQUIRED in the authoring schema, so re-parsing a
 * stripStudentPayload()-cleaned object against it would fail closed instead
 * of open — this schema is what the player page re-validates the student
 * payload against (defense in depth: even if stripStudentPayload regressed,
 * this schema has no field to leak the answer through).
 */
export const conceptCardsStudentPayload = z.object({
  conceptSlug: z.string().min(1),
  variants: z.array(gridVariantSchema).length(1),
  autoCollect: z.boolean().default(true),
  nonFatalBumps: z.boolean().default(false),
  budgets: z
    .object({ maxCommands: z.number().int().positive().max(10_000).default(1000) })
    .default({ maxCommands: 1000 }),
  workedExample: z.object({ blocks: z.unknown(), caption: localizedText }),
  faded: z.object({
    blocks: z.unknown(),
    toolbox: z.array(blockRefSchema).min(1),
    caption: localizedText,
  }),
});

export const conceptCardsAnswerSchema = z.object({
  /** The bb_* type the student dropped into the gap. */
  blockType: z.string().min(1),
});
export type ConceptCardsAnswer = z.infer<typeof conceptCardsAnswerSchema>;

export function gradeConceptCards(
  snapshot: LevelSnapshot,
  answer: ConceptCardsAnswer,
): ActivityGradeResult {
  const parsed = conceptCardsPayload.safeParse(snapshot.payload);
  if (!parsed.success) {
    return {
      verdict: "ERROR",
      qualityPassed: false,
      primaryFeedback: { code: "runtimeError", data: { reason: "invalidPayload" } },
      generatedCode: "",
      blockCount: null,
      summary: {},
    };
  }
  const payload = parsed.data;
  const correct = answer.blockType === payload.faded.missingBlockType;
  return {
    verdict: correct ? "PASS" : "FAIL",
    qualityPassed: correct,
    // Not "wrongBlock": the copy invites another go at the same gap rather
    // than reporting a failure. There is no failure state in a lesson.
    primaryFeedback: correct ? null : { code: "tryAnotherBlock" },
    generatedCode: "",
    blockCount: null,
    // Which block a student reached for is the misconception signal this step
    // exists to surface (LEARN-STEP-SPEC.md follow-on 1), so it is recorded
    // on every attempt, right and wrong.
    summary: { blockType: answer.blockType, conceptSlug: payload.conceptSlug, correct },
  };
}
