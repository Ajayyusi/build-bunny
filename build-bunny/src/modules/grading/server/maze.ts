import "server-only";

import { z } from "zod";

import type { GridVariantSpec } from "@/engine";
import {
  analyzeMazeDesign,
  mazeGridPayload,
  type MazeIssue,
} from "@/modules/activities/maze";
import { creativeProjectPayload, gridVariantSchema } from "@/modules/curriculum/schemas";
import type { LevelSnapshot } from "@/modules/curriculum/server/publish";

import { gradeWorkspace, type GradeOutcome } from "./grade";

/**
 * Build-your-own maze grading (CREATIVE_PROJECT, kind MAZE). Two halves,
 * both authoritative: the DESIGN must meet the level's rules and be
 * winnable (analyzeMazeDesign — the same function the designer's checklist
 * runs), and the PROGRAM must solve that design through gradeWorkspace,
 * exactly as a puzzle would. Used by the attempts pipeline, the publish
 * gates (on the author's sample) and the teacher replay.
 */

export const mazeAnswerSchema = z
  .object({ workspaceJson: z.unknown(), design: gridVariantSchema })
  .strict();
export type MazeAnswer = z.infer<typeof mazeAnswerSchema>;

export interface MazeGrade {
  /** Why the design was refused; empty when the program was graded. */
  issues: MazeIssue[];
  /** The program's grade against the design (null when the design was refused). */
  outcome: GradeOutcome | null;
  /** The generated one-variant grid payload — what a replay renders. */
  gridPayload: ReturnType<typeof mazeGridPayload> | null;
}

export function gradeMaze(snapshot: LevelSnapshot, answer: MazeAnswer): MazeGrade {
  const parsed = creativeProjectPayload.safeParse(snapshot.payload);
  if (!parsed.success) return { issues: [{ code: "boardSize" }], outcome: null, gridPayload: null };
  const payload = parsed.data;
  const design: GridVariantSpec = answer.design;

  const issues = analyzeMazeDesign(payload, design);
  if (issues.length > 0) return { issues, outcome: null, gridPayload: null };

  const gridPayload = mazeGridPayload(payload, design);
  const outcome = gradeWorkspace(
    { ...snapshot, activityType: "BLOCK_CODING", payload: gridPayload },
    answer.workspaceJson,
  );
  return { issues: [], outcome, gridPayload };
}
