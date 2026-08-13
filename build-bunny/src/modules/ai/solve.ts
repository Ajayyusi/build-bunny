import { classify, type ClassLabel, type LabelledSpecimen } from "./knn";

/**
 * The solver for teach-by-example levels: what a student who understood the
 * lesson would submit.
 *
 * Block-coding levels ship a hand-recorded solution and the publish gates
 * re-run it. AI levels cannot: the "solution" is a CHOICE of examples, the
 * space of choices is combinatorial, and whether any given choice wins is a
 * property of nearest-neighbour geometry over a dozen hand-written decimals
 * rather than something an author can see by reading. So the solution is
 * computed instead of recorded.
 *
 * This exists because the integration playthrough used to "solve" these
 * levels by teaching the ENTIRE pool, which quietly stopped being a solution
 * the moment a level set an example cap — and a level whose lesson is
 * "choose well" is exactly the level where teaching everything must fail.
 *
 * It answers two questions, and a level needs both to be publishable:
 *   - is there a legal training set that WINS?   (or the level is cruel)
 *   - is there a legal training set that LOSES?  (or the level teaches nothing)
 */

export interface SolvablePayload {
  pool: { id: string; size: number; color: number; truth: ClassLabel }[];
  testSet: { id: string; size: number; color: number }[];
  minPerLabel: number;
  maxExamples?: number;
}

/**
 * Above this, enumerating every subset stops being cheap (2^18 = 262k sets,
 * each scored against the test set). No authored level is near it, and a
 * pool that large would be unreadable on a child's screen long before it
 * were slow here — so the limit is a tripwire, not a tuning knob.
 */
const MAX_ENUMERABLE_POOL = 18;

export class PoolTooLargeError extends Error {
  constructor(size: number) {
    super(`AI level pool has ${size} specimens; the solver enumerates at most ${MAX_ENUMERABLE_POOL}`);
    this.name = "PoolTooLargeError";
  }
}

/**
 * Every training set a student could honestly submit: any subset of the pool,
 * each specimen carrying its own recorded label, that satisfies the level's
 * own rules about how many of each kind and how many in total.
 *
 * Deliberately does NOT consider deliberately-mislabelled submissions. A
 * student CAN mislabel, and the grader handles it, but a level's winnability
 * must not depend on one — "you can only win this by writing down something
 * you can see is false" is not a lesson.
 */
function* legalTrainingSets(payload: SolvablePayload): Generator<LabelledSpecimen[]> {
  const pool = payload.pool;
  if (pool.length > MAX_ENUMERABLE_POOL) throw new PoolTooLargeError(pool.length);
  const examples: LabelledSpecimen[] = pool.map((p) => ({
    id: p.id,
    size: p.size,
    color: p.color,
    label: p.truth,
  }));

  // Smallest sets first: the answer we want is the leanest one, and a
  // student who understood the level submits few examples, not many.
  const byPopcount: number[][] = Array.from({ length: pool.length + 1 }, () => []);
  for (let mask = 1; mask < 1 << pool.length; mask += 1) {
    byPopcount[popcount(mask)]!.push(mask);
  }

  for (const masks of byPopcount) {
    for (const mask of masks) {
      const set = examples.filter((_, i) => (mask >> i) & 1);
      if (payload.maxExamples !== undefined && set.length > payload.maxExamples) continue;
      const positives = set.filter((e) => e.label === "positive").length;
      if (positives < payload.minPerLabel) continue;
      if (set.length - positives < payload.minPerLabel) continue;
      yield set;
    }
  }
}

function popcount(n: number): number {
  let count = 0;
  for (let x = n; x !== 0; x >>= 1) count += x & 1;
  return count;
}

/** Scores one training set the way the grader does. */
function scores(
  examples: LabelledSpecimen[],
  payload: SolvablePayload,
  truthOf: (probe: { size: number; color: number }) => ClassLabel,
): boolean {
  return payload.testSet.every((probe) => classify(examples, probe) === truthOf(probe));
}

/**
 * The leanest legal training set that gets every held-out specimen right, or
 * null when no honest choice wins. Deterministic: subsets are enumerated
 * smallest-first in pool order, so the same level always yields the same
 * solution and a test asserting on it will not flake.
 */
export function solveAiClassification(
  payload: SolvablePayload,
  truthOf: (probe: { size: number; color: number }) => ClassLabel,
): LabelledSpecimen[] | null {
  for (const set of legalTrainingSets(payload)) {
    if (scores(set, payload, truthOf)) return set;
  }
  return null;
}

/**
 * A legal training set that LOSES — proof the level can actually be failed.
 *
 * A level every submission passes is decoration: the child succeeds without
 * ever making the choice the level exists to teach, and nothing about that is
 * visible from reading the fixture.
 */
export function findFailingTrainingSet(
  payload: SolvablePayload,
  truthOf: (probe: { size: number; color: number }) => ClassLabel,
): LabelledSpecimen[] | null {
  for (const set of legalTrainingSets(payload)) {
    if (!scores(set, payload, truthOf)) return set;
  }
  return null;
}
