import type { Line, Point, Side } from "./types";

/**
 * Tight float tolerance for "exactly on the line" — content coordinates are
 * small hand-authored numbers, so genuine floating-point noise is far below
 * this, and it keeps the tie rule below deterministic rather than flaky.
 */
const EPSILON = 1e-9;

/**
 * Signed offset of a point from a line: positive above a sloped line (or to
 * the right, i.e. greater x, of a vertical one), negative below/left, zero
 * exactly on it. This is the one primitive both sideOfLine and every
 * distance-flavoured caller build on.
 */
export function signedOffset(point: Point, line: Line): number {
  if ("vertical" in line) return point.x - line.x;
  return point.y - (line.slope * point.x + line.intercept);
}

/**
 * Which side of a line a point falls on. A point exactly on the line (within
 * EPSILON) is treated as "pos" — a deliberate, documented, deterministic tie
 * rule rather than a third state, because every caller here ultimately needs
 * a two-way classification decision.
 */
export function sideOfLine(point: Point, line: Line): Side {
  return signedOffset(point, line) >= -EPSILON ? "pos" : "neg";
}
