/**
 * The handoff's first session: "A 5 to 8 minute first session should
 * deliver a real insight". Measured in real classrooms, without naming
 * anyone: for each child, the minutes from first opening Train a Sorter to
 * first finishing it (within the hour, so a child who left and came back
 * days later doesn't count as a 3-day session). Shown only once at least
 * five children have finished, like the other small-group counts.
 */
export const FIRST_SESSION_MIN_CHILDREN = 5;
export const FIRST_SESSION_TARGET = { min: 5, max: 8 } as const;

export interface FirstSessionSummary {
  children: number;
  medianMinutes: number;
  /** Children who finished within the 5 to 8 minute aim (or faster). */
  withinTarget: number;
}

export function summariseFirstSession(minutes: readonly number[]): FirstSessionSummary | null {
  const sorted = minutes.filter((m) => Number.isFinite(m) && m >= 0).sort((a, b) => a - b);
  if (sorted.length < FIRST_SESSION_MIN_CHILDREN) return null;
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
  return {
    children: sorted.length,
    medianMinutes: Math.round(median * 10) / 10,
    withinTarget: sorted.filter((m) => m <= FIRST_SESSION_TARGET.max).length,
  };
}
