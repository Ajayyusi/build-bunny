import "server-only";

import { z } from "zod";

import { localizedText, codePredictionPayload } from "@/modules/curriculum/schemas";
import type { LevelSnapshot } from "@/modules/curriculum/server/publish";
import type { ActivityGradeResult } from "../types";

/**
 * CODE_PREDICTION engine (m4 task 4). Student reads payload.code (never
 * executed — it's a comprehension check, not a runnable program) and picks
 * one option; grading is a straight comparison against correctOptionId,
 * which never leaves the server.
 */

/**
 * Answer-free mirror of codePredictionPayload (curriculum/schemas.ts).
 * correctOptionId is REQUIRED in the authoring schema, so re-parsing a
 * stripStudentPayload()-cleaned object against it would fail closed instead
 * of open — this schema is what the player page re-validates the student
 * payload against (defense in depth: even if stripStudentPayload regressed,
 * this schema has no field to leak the answer through).
 */
export const codePredictionStudentPayload = z.object({
  code: z.string().min(1),
  language: z.literal("javascript").default("javascript"),
  prompt: localizedText,
  options: z
    .array(z.object({ id: z.string().min(1), text: localizedText }))
    .min(2)
    .max(5),
  wrongFeedback: localizedText.optional(),
});

export const codePredictionAnswerSchema = z.object({
  optionId: z.string().min(1),
});
export type CodePredictionAnswer = z.infer<typeof codePredictionAnswerSchema>;

export function gradeCodePrediction(
  snapshot: LevelSnapshot,
  answer: CodePredictionAnswer,
): ActivityGradeResult {
  const parsed = codePredictionPayload.safeParse(snapshot.payload);
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
  const correct = answer.optionId === payload.correctOptionId;
  return {
    verdict: correct ? "PASS" : "FAIL",
    qualityPassed: correct,
    primaryFeedback: correct ? null : { code: "wrongOption" },
    generatedCode: "",
    blockCount: null,
    summary: { optionId: answer.optionId, correct },
  };
}
