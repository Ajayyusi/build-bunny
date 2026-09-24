import "server-only";

import type { LevelSnapshot } from "@/modules/curriculum/server/publish";
import { gradeMaze, mazeAnswerSchema, type MazeAnswer } from "@/modules/grading/server/maze";

import type { ActivityGradeResult } from "../types";

/**
 * CREATIVE_PROJECT adapter (build-your-own maze): reshapes gradeMaze into
 * the registry's common ActivityGradeResult, like grid.ts does for
 * gradeWorkspace. A refused design is a FAIL the child can act on
 * ("mazeInvalid" names the first checklist rule it breaks) — it never
 * reaches the interpreter.
 */

export const creativeProjectAnswerSchema = mazeAnswerSchema;
export type CreativeProjectAnswer = MazeAnswer;

export function gradeCreativeProject(
  snapshot: LevelSnapshot,
  answer: CreativeProjectAnswer,
): ActivityGradeResult {
  const { issues, outcome } = gradeMaze(snapshot, answer);
  if (!outcome) {
    return {
      verdict: "FAIL",
      qualityPassed: false,
      primaryFeedback: { code: "mazeInvalid", data: { issue: issues[0]?.code ?? "boardSize" } },
      generatedCode: "",
      blockCount: null,
      summary: { mazeIssues: issues },
    };
  }
  return {
    verdict: outcome.verdict,
    qualityPassed: outcome.qualityPassed,
    primaryFeedback: outcome.primaryFeedback,
    generatedCode: outcome.generatedCode,
    blockCount: outcome.blockStats.totalBlocks,
    summary: { perVariant: outcome.perVariant, design: answer.design },
  };
}
