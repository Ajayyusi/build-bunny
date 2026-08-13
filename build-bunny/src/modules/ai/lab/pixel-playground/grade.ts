import type { ActivityGradeResult, ActivityVerdict } from "@/modules/activities/types";

import { invalidAnswerResult } from "../shared";
import {
  pixelPlaygroundAnswerSchema,
  type PixelPlaygroundConfig,
  type StudentPixelPlaygroundConfig,
} from "./types";

/**
 * "See Like a Computer" grading (g-contracts): PASS requires every mystery
 * round identified correctly. Feedback names how many were right, never
 * which — same "how close, not which" convention as carrotsLeft.
 */
export function gradePixelPlayground(
  config: PixelPlaygroundConfig,
  submission: unknown,
): ActivityGradeResult {
  const parsed = pixelPlaygroundAnswerSchema.safeParse(submission);
  if (!parsed.success) return invalidAnswerResult();

  const total = config.rounds.length;
  let correct = 0;
  const results: Record<string, boolean> = {};
  for (const round of config.rounds) {
    const picked = parsed.data.rounds[round.id];
    const isCorrect = picked === round.imageId;
    results[round.id] = isCorrect;
    if (isCorrect) correct++;
  }

  let verdict: ActivityVerdict;
  if (correct === total) verdict = "PASS";
  else if (correct >= Math.ceil(total / 2)) verdict = "PARTIAL";
  else verdict = "FAIL";

  const qualityPassed = correct === total;
  const primaryFeedback =
    verdict === "PASS" ? null : { code: "mysteryRoundsWrong", data: { correct, total } };

  return {
    verdict,
    qualityPassed,
    primaryFeedback,
    generatedCode: "",
    blockCount: null,
    summary: { correct, total, results },
  };
}

/**
 * Strips each round's imageId (the answer key — which of the visible,
 * named `images` this round's pixels came from) while keeping `src` so the
 * canvas can still load and downsample real pixels. `images` itself stays
 * fully visible: it's the multiple-choice list the child picks from, same
 * as CODE_PREDICTION's options — only which one is correct is secret.
 */
export function stripPixelPlaygroundConfig(
  config: PixelPlaygroundConfig,
): StudentPixelPlaygroundConfig {
  const imageById = new Map(config.images.map((image) => [image.id, image]));
  return {
    widgetId: "pixel-playground",
    images: config.images.map((image) => ({ id: image.id, src: image.src, name: image.name })),
    resolutions: config.resolutions,
    rounds: config.rounds.map((round) => ({
      id: round.id,
      resolution: round.resolution,
      src: imageById.get(round.imageId)?.src ?? "",
    })),
  };
}
