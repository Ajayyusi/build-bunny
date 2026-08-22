/**
 * Validators for autosaved widget work.
 *
 * A draft is the child's own work, but it still arrives from a past session
 * and may be stale, hand-edited, or from an older version of the level. Every
 * widget therefore validates before restoring: anything that does not parse
 * degrades to the widget's normal starting state rather than throwing the
 * level away on load.
 */

export interface Line {
  slope: number;
  intercept: number;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** `{ line: { slope, intercept } }` — TrendLine and BoundaryBuilder. */
export function restoreLine(work: unknown): Line | null {
  if (work === null || typeof work !== "object") return null;
  const line = (work as { line?: unknown }).line;
  if (line === null || typeof line !== "object") return null;
  const { slope, intercept } = line as { slope?: unknown; intercept?: unknown };
  if (!isFiniteNumber(slope) || !isFiniteNumber(intercept)) return null;
  return { slope, intercept };
}

/**
 * `{ rounds: { [roundId]: imageId } }` — PixelPlayground. Keeps only rounds
 * this level still has, and only answers that name one of its images, so a
 * level edited since the draft was written cannot restore an impossible one.
 */
export function restoreRounds(
  work: unknown,
  validRoundIds: readonly string[],
  validImageIds: readonly string[],
): Record<string, string> {
  if (work === null || typeof work !== "object") return {};
  const rounds = (work as { rounds?: unknown }).rounds;
  if (rounds === null || typeof rounds !== "object") return {};

  const rounds$ = new Set(validRoundIds);
  const images$ = new Set(validImageIds);
  const out: Record<string, string> = {};
  for (const [roundId, imageId] of Object.entries(rounds as Record<string, unknown>)) {
    if (rounds$.has(roundId) && typeof imageId === "string" && images$.has(imageId)) {
      out[roundId] = imageId;
    }
  }
  return out;
}
