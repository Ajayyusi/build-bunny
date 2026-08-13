import { sideOfLine } from "./sideOfLine";
import type { LabeledPoint, Line, Point, Side } from "./types";

const EPSILON = 1e-9;

export interface CentroidClassifier {
  line: Line;
  centroids: Record<string, Point>;
  /** Which half-plane each label's own centroid lands on — a genuine classifier needs this to label new points. */
  sideForLabel: Record<string, Side>;
}

function centroidOf(points: readonly LabeledPoint[], label: string): Point {
  const group = points.filter((p) => p.label === label);
  const n = group.length || 1;
  const sum = group.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
  return { x: sum.x / n, y: sum.y / n };
}

/**
 * "Let the computer try": the simplest honest classifier there is — the
 * perpendicular bisector of the segment joining each label's centroid. Its
 * decision boundary can genuinely be vertical (when the two centroids share
 * a y) or horizontal (when they share an x), so the result is a general
 * Line, not the {slope,intercept}-only wire shape a child's dragged line
 * submits as.
 */
export function centroidRule(
  points: readonly LabeledPoint[],
  labelIds: readonly [string, string],
): CentroidClassifier {
  const [labelA, labelB] = labelIds;
  const centroidA = centroidOf(points, labelA);
  const centroidB = centroidOf(points, labelB);
  const midX = (centroidA.x + centroidB.x) / 2;
  const midY = (centroidA.y + centroidB.y) / 2;
  const dx = centroidB.x - centroidA.x;
  const dy = centroidB.y - centroidA.y;

  let line: Line;
  if (Math.abs(dx) < EPSILON) {
    // Centroids share an x — the segment between them is vertical, so its
    // perpendicular bisector is a horizontal line.
    line = { slope: 0, intercept: midY };
  } else if (Math.abs(dy) < EPSILON) {
    // Centroids share a y — the segment is horizontal, so the bisector is
    // vertical. {slope,intercept} cannot express this.
    line = { vertical: true, x: midX };
  } else {
    const segmentSlope = dy / dx;
    const perpendicularSlope = -1 / segmentSlope;
    const intercept = midY - perpendicularSlope * midX;
    line = { slope: perpendicularSlope, intercept };
  }

  const sideForLabel: Record<string, Side> = {
    [labelA]: sideOfLine(centroidA, line),
    [labelB]: sideOfLine(centroidB, line),
  };

  return { line, centroids: { [labelA]: centroidA, [labelB]: centroidB }, sideForLabel };
}
