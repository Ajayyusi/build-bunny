import { z } from "zod";

import type { trendLineConfig } from "@/modules/curriculum/schemas";

/** The full authored config — points and predictAt are the exercise itself, nothing to hide. */
export type TrendLineConfig = z.infer<typeof trendLineConfig>;

/** Wire shape pinned by g-contracts: `{ answer: { line: {slope,intercept}, prediction } }`. */
export const trendLineAnswerSchema = z.object({
  line: z.object({ slope: z.number(), intercept: z.number() }),
  prediction: z.number(),
});
export type TrendLineAnswer = z.infer<typeof trendLineAnswerSchema>;

/** What the widget reports upward via its imperative handle. */
export interface TrendLineWork {
  line: { slope: number; intercept: number };
  prediction: number;
}
