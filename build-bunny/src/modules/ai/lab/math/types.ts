/**
 * Shared value types for the AI Lab pure math (phase G, agent A). Every
 * function in this directory is deterministic and DOM-free: the client
 * widgets and the server grader both import these exact functions so what a
 * child sees while dragging a line or editing a kernel is what gets graded —
 * never a re-implementation that could quietly drift.
 */

export interface Point {
  x: number;
  y: number;
}

export interface LabeledPoint extends Point {
  id: string;
  label: string;
}

/**
 * A line either as slope+intercept (y = slope*x + intercept, the wire shape
 * pinned by g-contracts for a submitted answer) or as a vertical line
 * (x = constant) — a case slope/intercept cannot represent but that a
 * centroid-rule boundary can genuinely produce (see centroidRule.ts). The
 * widgets keep a child's own draggable line non-vertical by construction
 * (a minimum handle gap), so only the centroid-rule comparison line ever
 * takes the vertical branch.
 */
export type Line = { slope: number; intercept: number } | { vertical: true; x: number };

/** Which half-plane a point falls in relative to a Line. Ties favour "pos" — see sideOfLine.ts. */
export type Side = "pos" | "neg";

export interface RGB {
  r: number;
  g: number;
  b: number;
}

/** Row-major grid: grid[y][x]. */
export type Grid<T> = readonly (readonly T[])[];

export type Kernel3x3 = readonly [
  readonly [number, number, number],
  readonly [number, number, number],
  readonly [number, number, number],
];
