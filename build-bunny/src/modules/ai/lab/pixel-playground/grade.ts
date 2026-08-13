import { readFileSync } from "node:fs";
import { join } from "node:path";

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
 * Round pixels are inlined as a data: URI rather than served as the source
 * asset's own path.
 *
 * Stripping `imageId` alone was not enough: a mystery round's `src` used to
 * be the *same string* as one entry in the visible `images` list, so anyone
 * opening DevTools could read off every answer without doing the exercise.
 * Inlining gives the canvas identical pixels while breaking that 1:1 match.
 *
 * Residual, recorded honestly rather than papered over: a determined student
 * who base64-decodes a round and reads the SVG markup can still recognise the
 * shape. Closing that fully means rasterising server-side and shipping only
 * the downsampled grid — a real fix, not a free one, and it needs an image
 * pipeline this project deliberately does not have yet. See
 * docs/ai-data-flow.md.
 */
const inlineCache = new Map<string, string | null>();

function inlineAsset(src: string): string | null {
  const cached = inlineCache.get(src);
  if (cached !== undefined) return cached;

  let result: string | null = null;
  // Only ever read from public/, and only plain relative asset paths — never
  // anything that could climb out of it.
  if (/^\/[\w./-]+\.svg$/.test(src) && !src.includes("..")) {
    try {
      const svg = readFileSync(join(process.cwd(), "public", src), "utf8");
      result = `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;
    } catch {
      // Asset missing or unreadable — fall back to the plain path below so a
      // deployment packaging slip degrades the puzzle rather than breaking it.
      result = null;
    }
  }
  inlineCache.set(src, result);
  return result;
}

/**
 * Strips each round's imageId (the answer key — which of the visible,
 * named `images` this round's pixels came from) and serves its pixels
 * inlined, so no round can be matched back to an option by its URL.
 * `images` itself stays fully visible: it's the multiple-choice list the
 * child picks from, same as CODE_PREDICTION's options — only which one is
 * correct is secret.
 */
export function stripPixelPlaygroundConfig(
  config: PixelPlaygroundConfig,
): StudentPixelPlaygroundConfig {
  const imageById = new Map(config.images.map((image) => [image.id, image]));
  return {
    widgetId: "pixel-playground",
    images: config.images.map((image) => ({ id: image.id, src: image.src, name: image.name })),
    resolutions: config.resolutions,
    rounds: config.rounds.map((round) => {
      const src = imageById.get(round.imageId)?.src ?? "";
      return {
        id: round.id,
        resolution: round.resolution,
        src: src === "" ? "" : (inlineAsset(src) ?? src),
      };
    }),
  };
}
