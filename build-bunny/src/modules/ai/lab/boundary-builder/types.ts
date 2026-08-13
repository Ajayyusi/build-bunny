import { z } from "zod";

import type { boundaryBuilderConfig } from "@/modules/curriculum/schemas";

/** The full authored config (nothing in it is answer-bearing — see grade.ts's stripConfig). */
export type BoundaryBuilderConfig = z.infer<typeof boundaryBuilderConfig>;

/** Wire shape pinned by g-contracts: `{ answer: { line: {slope,intercept}, sorts? } }`. */
export const boundaryBuilderAnswerSchema = z.object({
  line: z.object({ slope: z.number(), intercept: z.number() }),
  /**
   * Optional hand-sort warm-up some future authoring may attach; never used
   * for grading (the line is the actual assessed work) so it's accepted and
   * ignored rather than rejected.
   */
  sorts: z.record(z.string(), z.string()).optional(),
});
export type BoundaryBuilderAnswer = z.infer<typeof boundaryBuilderAnswerSchema>;

/** What the widget reports upward via its imperative handle. */
export interface BoundaryBuilderWork {
  line: { slope: number; intercept: number };
}

export function labelIdsOf(config: BoundaryBuilderConfig): [string, string] {
  return [config.labels[0]!.id, config.labels[1]!.id];
}
