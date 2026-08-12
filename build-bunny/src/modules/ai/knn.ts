/**
 * The 1-nearest-neighbour classifier behind AI_CLASSIFICATION.
 *
 * Deliberately NOT server-only: the player shows the student what the bunny
 * currently guesses, and the server decides whether that guess was right.
 * If those two ever disagreed, a child would watch the bunny say "safe" and
 * then be told they were wrong — so both sides import this one function
 * rather than keeping a copy each.
 *
 * Pure, dependency-free, and small enough to read aloud to the class: it
 * picks the taught example that looks most like the new berry and copies its
 * label. That explainability is the reason 1-NN was chosen over anything
 * with weights to tune.
 */

export type ClassLabel = "positive" | "negative";

export interface Features {
  size: number;
  color: number;
}

export interface LabelledSpecimen extends Features {
  id: string;
  label: ClassLabel;
}

/**
 * Squared distance: only the ORDER matters for nearest-neighbour, so the
 * square root would be arithmetic without a purpose.
 */
export function distanceSq(a: Features, b: Features): number {
  const ds = a.size - b.size;
  const dc = a.color - b.color;
  return ds * ds + dc * dc;
}

/**
 * Nearest taught example wins. Ties break toward the earlier example in the
 * given order, which keeps the result deterministic — a tie that flipped
 * between calls would show a child two different answers for identical work.
 * Returns null when nothing has been taught yet.
 */
export function classify(
  examples: readonly LabelledSpecimen[],
  probe: Features,
): ClassLabel | null {
  let best: LabelledSpecimen | null = null;
  let bestDist = Infinity;
  for (const example of examples) {
    const d = distanceSq(example, probe);
    if (d < bestDist) {
      bestDist = d;
      best = example;
    }
  }
  return best?.label ?? null;
}

/**
 * The exact shape a submission may carry, and nothing else.
 *
 * Pool specimens also hold `truth` — what happened when the bunny ate that
 * berry — which the student needs to SEE but the grader must never receive.
 * The attempts route validates with .strict(), so spreading a whole specimen
 * into a submission rejects it outright. Funnelling every submission through
 * this function is what keeps that from happening again.
 */
export function toTrainingExample(specimen: LabelledSpecimen): LabelledSpecimen {
  const { id, size, color, label } = specimen;
  return { id, size, color, label };
}
