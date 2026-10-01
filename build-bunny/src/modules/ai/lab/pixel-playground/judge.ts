import type { PixelPlaygroundConfig, PixelRoundCheckResult } from "./types";
import { roundSteps } from "./steps";

/**
 * The decision behind "Check my guess", from the FULL (answer-bearing)
 * config — so server side only in practice (check.ts). Null when the round
 * or the resolution isn't one this level has.
 */
export function judgePixelRound(
  config: PixelPlaygroundConfig,
  input: { roundId: string; imageId: string; resolution: number },
): PixelRoundCheckResult | null {
  const round = config.rounds.find((r) => r.id === input.roundId);
  if (!round) return null;
  const steps = roundSteps(config.resolutions, round.resolution);
  if (!steps.includes(input.resolution)) return null;
  const correct = input.imageId === round.imageId;
  const final = input.resolution >= steps[steps.length - 1]!;
  const image = config.images.find((i) => i.id === round.imageId);
  return {
    correct,
    final,
    answer:
      correct || final
        ? {
            imageId: round.imageId,
            clue: image?.clue ?? null,
            ...(image?.clueChoices ? { clueChoices: image.clueChoices } : {}),
          }
        : null,
  };
}
