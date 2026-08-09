import "server-only";

import { gradeWorkspace } from "@/modules/grading/server/grade";
import type { LevelSnapshot } from "@/modules/curriculum/server/publish";
import type { ActivityGradeResult } from "../types";

/**
 * BLOCK_CODING/DEBUGGING adapter: gradeWorkspace (pinned m3 contract, also
 * consumed directly by gates.ts and — per m4-contracts — teacher analytics'
 * attempt replay) is NOT moved or changed here. This file only reshapes its
 * GradeOutcome into the registry's common ActivityGradeResult so submit.ts
 * can dispatch every activity type through one code path.
 */
export function gradeGridActivity(
  snapshot: LevelSnapshot,
  workspaceJson: unknown,
): ActivityGradeResult {
  const outcome = gradeWorkspace(snapshot, workspaceJson);
  return {
    verdict: outcome.verdict,
    qualityPassed: outcome.qualityPassed,
    primaryFeedback: outcome.primaryFeedback,
    generatedCode: outcome.generatedCode,
    blockCount: outcome.blockStats.totalBlocks,
    summary: { perVariant: outcome.perVariant },
  };
}
