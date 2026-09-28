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
export function nearest(
  examples: readonly LabelledSpecimen[],
  probe: Features,
): LabelledSpecimen | null {
  let best: LabelledSpecimen | null = null;
  let bestDist = Infinity;
  for (const example of examples) {
    const d = distanceSq(example, probe);
    if (d < bestDist) {
      bestDist = d;
      best = example;
    }
  }
  return best;
}

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

/**
 * How sure the 1-nearest-neighbour answer is, 0 to 1: how much nearer the
 * example it copied is than the nearest example of the other kind. 1 = the
 * other kind is far away; 0 = both are just as near (a coin toss). Null
 * until both kinds have been taught. An honest, simple margin — not a
 * probability.
 */
export function sureness(examples: readonly LabelledSpecimen[], probe: Features): number | null {
  const best = { positive: Infinity, negative: Infinity };
  for (const example of examples) {
    const d = distanceSq(example, probe);
    if (d < best[example.label]) best[example.label] = d;
  }
  if (!Number.isFinite(best.positive) || !Number.isFinite(best.negative)) return null;
  const near = Math.sqrt(Math.min(best.positive, best.negative));
  const far = Math.sqrt(Math.max(best.positive, best.negative));
  return far === 0 ? 0 : 1 - near / far;
}

/**
 * A close call (grades 5 to 7's deeper test): the nearest example of the
 * other label is almost as near as the one the machine copied, so a small
 * change in the examples could flip the answer — the classifier's honest
 * "not very sure". False when only one label has been taught.
 */
export function closeCall(examples: readonly LabelledSpecimen[], probe: Features, ratio = 0.8): boolean {
  const best = { positive: Infinity, negative: Infinity };
  for (const example of examples) {
    const d = distanceSq(example, probe);
    if (d < best[example.label]) best[example.label] = d;
  }
  if (!Number.isFinite(best.positive) || !Number.isFinite(best.negative)) return false;
  const near = Math.sqrt(Math.min(best.positive, best.negative));
  const far = Math.sqrt(Math.max(best.positive, best.negative));
  return far === 0 || near / far >= ratio;
}

/**
 * The two kinds of mistake on a test (grades 5 to 7's deeper test): said
 * "positive" when it wasn't (a false yes), and missed a real "positive".
 * The truth of a missed probe is the opposite of the machine's guess, so
 * this needs no answer key in the browser.
 */
export function mistakeKinds(
  guesses: readonly { id: string; guess: ClassLabel | null }[],
  missed: readonly string[],
): { falseYes: number; missedYes: number } {
  let falseYes = 0;
  let missedYes = 0;
  for (const { id, guess } of guesses) {
    if (!missed.includes(id)) continue;
    if (guess === "positive") falseYes += 1;
    else if (guess === "negative") missedYes += 1;
  }
  return { falseYes, missedYes };
}
