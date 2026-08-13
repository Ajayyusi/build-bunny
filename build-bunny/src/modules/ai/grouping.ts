import { distanceSq, type Features } from "./knn";

/**
 * The mathematics behind PATTERN_RECOGNITION — "the Grouping Machine".
 *
 * Deliberately NOT server-only, for the same reason as knn.ts: the player
 * shows a live tightness meter and animates the training loop, and the
 * grader replays both from the submitted seed. If the two computations ever
 * disagreed, a child would watch their piles score one number and be graded
 * on another. One module, imported by both, is the only arrangement that
 * makes that impossible.
 *
 * Everything here is pure and deterministic: no randomness, and every tie
 * broken the same way on every call (lowest marker index wins). A tie that
 * flipped between the player's animation and the grader's replay would send
 * the same seed to two different fixed points.
 */

/** Nearest-marker index for one specimen. Ties → the lowest marker index. */
export function assign(specimen: Features, markers: readonly Features[]): number {
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < markers.length; i += 1) {
    const d = distanceSq(specimen, markers[i]!);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}

/** Mean position of a set of specimens. */
export function centroid(specimens: readonly Features[]): Features {
  let size = 0;
  let color = 0;
  for (const s of specimens) {
    size += s.size;
    color += s.color;
  }
  const n = specimens.length || 1;
  return { size: size / n, color: color / n };
}

/** Total squared distance from every specimen to its nearest marker. */
export function spread(specimens: readonly Features[], markers: readonly Features[]): number {
  let total = 0;
  for (const s of specimens) {
    let best = Infinity;
    for (const m of markers) {
      const d = distanceSq(s, m);
      if (d < best) best = d;
    }
    total += best;
  }
  return total;
}

/**
 * How tight the piles are, 0–1-ish: 1 minus the spread relative to the
 * spread of the do-nothing answer (one marker at the centroid of the SAME
 * specimens). Recomputing the baseline over the kept set matters — after an
 * exclusion, scoring against the original baseline would reward the removal
 * twice.
 *
 * Can go negative (markers worse than a single centred marker); the player
 * clamps the DISPLAY at zero but the maths must not, or two terrible
 * answers would tie instead of ordering.
 */
export function tightness(specimens: readonly Features[], markers: readonly Features[]): number {
  const baseline = spread(specimens, [centroid(specimens)]);
  if (baseline === 0) return 1;
  return 1 - spread(specimens, markers) / baseline;
}

/**
 * One step of the training loop, exactly as a child can say it out loud:
 * every dot joins its nearest flag, then every flag moves to the middle of
 * the dots that joined it. A flag that owns no dots stays where it is —
 * deleting it would change the marker count mid-run, and moving it anywhere
 * else would be a rule the child was never told.
 */
export function lloydStep(
  specimens: readonly Features[],
  markers: readonly Features[],
): Features[] {
  const groups: Features[][] = markers.map(() => []);
  for (const s of specimens) {
    groups[assign(s, markers)]!.push(s);
  }
  return markers.map((m, i) => (groups[i]!.length === 0 ? m : centroid(groups[i]!)));
}

/**
 * Run the loop to convergence or the iteration cap, whichever comes first.
 * Convergence = no marker moved; with centroids on finite data the loop
 * cannot cycle, so a small cap is a guard rail rather than a truncation.
 */
export function runLloyd(
  specimens: readonly Features[],
  seed: readonly Features[],
  iterations: number,
): Features[] {
  let markers = [...seed];
  for (let i = 0; i < iterations; i += 1) {
    const next = lloydStep(specimens, markers);
    const moved = next.some(
      (m, j) => m.size !== markers[j]!.size || m.color !== markers[j]!.color,
    );
    markers = next;
    if (!moved) break;
  }
  return markers;
}
