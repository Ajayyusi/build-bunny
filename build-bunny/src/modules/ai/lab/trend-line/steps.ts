/**
 * How far one arrow-key press moves the Fortune Teller's line, as a fraction
 * of the plotted range.
 *
 * These live beside the grader rather than in the widget because they decide
 * whether the level is winnable at all. gradeTrendLine passes a child whose
 * total miss is within `toleranceFactor` of the least-squares optimum, and
 * that tolerance defines a narrow band of intercepts. If one key press moves
 * the line further than that band is wide, a child on the keyboard steps
 * from one side of the answer clean past the other and can never land on it,
 * however well they understand the puzzle. That is what shipped: the step
 * was 1/40 of the range, and the band on the shipped fixture is narrower
 * than that.
 *
 * content-fixtures.test.ts holds these against every authored trend-line
 * level, so tightening a level's toleranceFactor fails the suite instead of
 * quietly making the level keyboard-only-impossible.
 */
export const INTERCEPT_STEP_FRACTION = 1 / 200;
export const SLOPE_STEP_FRACTION = 1 / 100;
