import { sideOfLine } from "./sideOfLine";
import type { LabeledPoint, Line, Side } from "./types";

/**
 * A line only defines two half-planes — it doesn't know which one is
 * "label A territory". countMisclassified resolves that the way a simple
 * classifier would: try both assignments of {labelA, labelB} to {pos, neg}
 * and keep whichever produces fewer errors. This is what the live widget
 * counter (dragging) and the server grader (submission) both call, so the
 * number a child watches wobble IS the number that gets graded.
 */
export interface ClassificationResult {
  errors: number;
  misclassifiedIds: string[];
  /** The orientation that produced `errors` — which half-plane each label was assigned to. */
  sideForLabel: Record<string, Side>;
}

export function countMisclassified(
  points: readonly LabeledPoint[],
  line: Line,
  labelIds: readonly [string, string],
): ClassificationResult {
  const [labelA, labelB] = labelIds;
  const sided = points.map((point) => ({ point, side: sideOfLine(point, line) }));

  function errorsWith(sideForLabel: Record<string, Side>): { errors: number; ids: string[] } {
    const ids: string[] = [];
    for (const { point, side } of sided) {
      if (sideForLabel[point.label] !== side) ids.push(point.id);
    }
    return { errors: ids.length, ids };
  }

  const optionA: Record<string, Side> = { [labelA]: "pos", [labelB]: "neg" };
  const optionB: Record<string, Side> = { [labelA]: "neg", [labelB]: "pos" };
  const a = errorsWith(optionA);
  const b = errorsWith(optionB);
  const winner = a.errors <= b.errors ? { sideForLabel: optionA, ...a } : { sideForLabel: optionB, ...b };
  return { errors: winner.errors, misclassifiedIds: winner.ids, sideForLabel: winner.sideForLabel };
}
