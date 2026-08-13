import { z } from "zod";

import type { LocalizedText, pixelPlaygroundConfig } from "@/modules/curriculum/schemas";

/** The full authored config — rounds[].imageId is the answer key, stripped for students (see grade.ts). */
export type PixelPlaygroundConfig = z.infer<typeof pixelPlaygroundConfig>;

export interface StudentPixelRound {
  id: string;
  resolution: number;
  /** The image to render for this round — present because the canvas needs real pixels; imageId (the answer) is not. */
  src: string;
}

/** Student-facing shape: images stay fully visible (they're the answer OPTIONS, like CODE_PREDICTION's options list). */
export interface StudentPixelPlaygroundConfig {
  widgetId: "pixel-playground";
  images: { id: string; src: string; name: LocalizedText }[];
  resolutions: number[];
  rounds: StudentPixelRound[];
}

/** Wire shape pinned by g-contracts: `{ answer: { rounds: Record<roundId, imageId> } }`. */
export const pixelPlaygroundAnswerSchema = z.object({
  rounds: z.record(z.string(), z.string()),
});
export type PixelPlaygroundAnswer = z.infer<typeof pixelPlaygroundAnswerSchema>;

/** What the widget reports upward via its imperative handle. */
export interface PixelPlaygroundWork {
  rounds: Record<string, string>;
}
