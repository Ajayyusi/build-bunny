import { describe, expect, it } from "vitest";

import { centroidRule } from "@/modules/ai/lab/math/centroidRule";
import { countMisclassified } from "@/modules/ai/lab/math/classify";
import { convolve3x3, EDGE_DETECTION_KERNEL } from "@/modules/ai/lab/math/convolve3x3";
import { downsampleGrid, downsampleRGB } from "@/modules/ai/lab/math/downsample";
import { greyscaleGrid, greyscaleValue } from "@/modules/ai/lab/math/greyscale";
import { leastSquares } from "@/modules/ai/lab/math/leastSquares";
import { signedOffset, sideOfLine } from "@/modules/ai/lab/math/sideOfLine";
import { sumSquaredError } from "@/modules/ai/lab/math/sumSquaredError";
import type { LabeledPoint, Line } from "@/modules/ai/lab/math/types";

/**
 * Pure-math coverage for the AI Lab widgets (phase G, agent A/client half).
 * Every case below is hand-computed in the comment above it — these are the
 * SAME functions the client widgets animate live and the server grader
 * recomputes from a submission, so a wrong vector here would mean a child's
 * on-screen number and the graded score could silently disagree.
 */

// ── leastSquares ────────────────────────────────────────────────────────

describe("leastSquares", () => {
  it("recovers an exact line y = 2x + 1 from 4 points lying exactly on it", () => {
    // sumX=6 sumY=16 sumXY=34 sumXX=14 n=4; denom=4*14-36=20;
    // slope=(4*34-6*16)/20=40/20=2; intercept=(16-2*6)/4=1.
    const points = [
      { x: 0, y: 1 },
      { x: 1, y: 3 },
      { x: 2, y: 5 },
      { x: 3, y: 7 },
    ];
    const fit = leastSquares(points);
    expect(fit.slope).toBeCloseTo(2, 10);
    expect(fit.intercept).toBeCloseTo(1, 10);
  });

  it("returns the flat mean-y line when every point shares the same x (degenerate)", () => {
    // sumX=15 sumY=9 sumXX=75; denom=3*75-225=0 → degenerate branch.
    const points = [
      { x: 5, y: 1 },
      { x: 5, y: 3 },
      { x: 5, y: 5 },
    ];
    const fit = leastSquares(points);
    expect(fit).toEqual({ slope: 0, intercept: 3 });
  });

  it("returns a flat line through the single point when n=1", () => {
    expect(leastSquares([{ x: 10, y: 7 }])).toEqual({ slope: 0, intercept: 7 });
  });

  it("returns the zero line for an empty set", () => {
    expect(leastSquares([])).toEqual({ slope: 0, intercept: 0 });
  });
});

// ── sumSquaredError ──────────────────────────────────────────────────────

describe("sumSquaredError", () => {
  const points = [
    { x: 0, y: 0 },
    { x: 1, y: 1 },
    { x: 2, y: 2 },
  ];

  it("is zero for a line that passes through every point", () => {
    expect(sumSquaredError(points, { slope: 1, intercept: 0 })).toBe(0);
  });

  it("sums squared vertical residuals for a line that misses every point", () => {
    // residuals vs y=1: -1, 0, 1 → squares 1, 0, 1 → sum 2.
    expect(sumSquaredError(points, { slope: 0, intercept: 1 })).toBe(2);
  });
});

// ── centroidRule ─────────────────────────────────────────────────────────

describe("centroidRule", () => {
  it("bisects two diagonally-separated clusters with a sloped line", () => {
    // centroidA=(0.5,0.5) centroidB=(5.5,5.5); dx=dy=5 → segmentSlope=1,
    // perpendicularSlope=-1; mid=(3,3); intercept = 3 - (-1*3) = 6.
    const points: LabeledPoint[] = [
      { id: "a1", x: 0, y: 0, label: "a" },
      { id: "a2", x: 0, y: 1, label: "a" },
      { id: "a3", x: 1, y: 0, label: "a" },
      { id: "a4", x: 1, y: 1, label: "a" },
      { id: "b1", x: 5, y: 5, label: "b" },
      { id: "b2", x: 5, y: 6, label: "b" },
      { id: "b3", x: 6, y: 5, label: "b" },
      { id: "b4", x: 6, y: 6, label: "b" },
    ];
    const result = centroidRule(points, ["a", "b"]);
    expect(result.line).toEqual({ slope: -1, intercept: 6 });
    expect(result.centroids.a).toEqual({ x: 0.5, y: 0.5 });
    expect(result.centroids.b).toEqual({ x: 5.5, y: 5.5 });
    // The line only makes sense as a classifier if each label's own centroid
    // lands on a different side of it.
    expect(result.sideForLabel.a).not.toBe(result.sideForLabel.b);
  });

  it("produces a VERTICAL line when the centroids share a y (horizontal segment)", () => {
    // centroidA=(0,1) centroidB=(4,1); dy=0 → vertical bisector at midX=2.
    const points: LabeledPoint[] = [
      { id: "a1", x: 0, y: 0, label: "a" },
      { id: "a2", x: 0, y: 2, label: "a" },
      { id: "b1", x: 4, y: 0, label: "b" },
      { id: "b2", x: 4, y: 2, label: "b" },
    ];
    const result = centroidRule(points, ["a", "b"]);
    expect(result.line).toEqual({ vertical: true, x: 2 });
  });

  it("produces a HORIZONTAL line when the centroids share an x (vertical segment)", () => {
    // centroidA=(1,1) centroidB=(1,5); dx=0 → horizontal bisector at midY=3.
    const points: LabeledPoint[] = [
      { id: "a1", x: 1, y: 0, label: "a" },
      { id: "a2", x: 1, y: 2, label: "a" },
      { id: "b1", x: 1, y: 4, label: "b" },
      { id: "b2", x: 1, y: 6, label: "b" },
    ];
    const result = centroidRule(points, ["a", "b"]);
    expect(result.line).toEqual({ slope: 0, intercept: 3 });
  });
});

// ── sideOfLine / signedOffset ────────────────────────────────────────────

describe("sideOfLine", () => {
  const diagonal: Line = { slope: 1, intercept: 0 }; // y = x

  it("classifies a point above a sloped line as pos", () => {
    expect(signedOffset({ x: 2, y: 3 }, diagonal)).toBe(1);
    expect(sideOfLine({ x: 2, y: 3 }, diagonal)).toBe("pos");
  });

  it("classifies a point below a sloped line as neg", () => {
    expect(signedOffset({ x: 2, y: 1 }, diagonal)).toBe(-1);
    expect(sideOfLine({ x: 2, y: 1 }, diagonal)).toBe("neg");
  });

  it("ties a point exactly on the line to pos", () => {
    expect(sideOfLine({ x: 2, y: 2 }, diagonal)).toBe("pos");
  });

  it("handles a VERTICAL line by comparing x", () => {
    const vertical: Line = { vertical: true, x: 5 };
    expect(sideOfLine({ x: 7, y: 0 }, vertical)).toBe("pos");
    expect(sideOfLine({ x: 3, y: 0 }, vertical)).toBe("neg");
    expect(sideOfLine({ x: 5, y: 100 }, vertical)).toBe("pos"); // on the line → tie → pos
  });
});

// ── classify (countMisclassified) ────────────────────────────────────────

describe("countMisclassified", () => {
  it("tries both label⇄side assignments and keeps the one with fewer errors", () => {
    const line: Line = { slope: 0, intercept: 0 }; // y = 0
    const points: LabeledPoint[] = [
      { id: "a1", x: 0, y: -1, label: "a" },
      { id: "a2", x: 1, y: -2, label: "a" },
      { id: "a3", x: 2, y: -1, label: "a" },
      { id: "a4-outlier", x: 5, y: 3, label: "a" }, // sits on the WRONG side
      { id: "b1", x: 0, y: 1, label: "b" },
      { id: "b2", x: 1, y: 2, label: "b" },
    ];
    // {a:neg, b:pos} gives exactly 1 error (a4-outlier); the reverse
    // assignment {a:pos, b:neg} gives 5 — the function must pick the former.
    const result = countMisclassified(points, line, ["a", "b"]);
    expect(result.errors).toBe(1);
    expect(result.misclassifiedIds).toEqual(["a4-outlier"]);
    expect(result.sideForLabel).toEqual({ a: "neg", b: "pos" });
  });

  it("returns zero errors for a perfectly separating line", () => {
    const line: Line = { slope: 0, intercept: 0 };
    const points: LabeledPoint[] = [
      { id: "a1", x: 0, y: -1, label: "a" },
      { id: "b1", x: 0, y: 1, label: "b" },
    ];
    const result = countMisclassified(points, line, ["a", "b"]);
    expect(result.errors).toBe(0);
    expect(result.misclassifiedIds).toEqual([]);
  });
});

// ── convolve3x3 ──────────────────────────────────────────────────────────

describe("convolve3x3", () => {
  // grid = [[1,2,3],[4,5,6],[7,8,9]], edge-clamped padding.
  const grid = [
    [1, 2, 3],
    [4, 5, 6],
    [7, 8, 9],
  ];

  it("computes the fully-interior center pixel with no clamping", () => {
    // 8*5 - (1+2+3+4+6+7+8+9) = 40 - 40 = 0.
    const out = convolve3x3(grid, EDGE_DETECTION_KERNEL);
    expect(out[1]![1]).toBe(0);
  });

  it("computes a corner pixel with edge-clamped (replicate) padding", () => {
    // Hand-worked (see comment in ai-lab-math.test.ts source): -1-1-2-1+8-2-4-4-5 = -12.
    const out = convolve3x3(grid, EDGE_DETECTION_KERNEL);
    expect(out[0]![0]).toBe(-12);
  });

  it("computes the opposite corner (180°-symmetric grid) as +12", () => {
    const out = convolve3x3(grid, EDGE_DETECTION_KERNEL);
    expect(out[2]![2]).toBe(12);
  });

  it("a flat grid convolves to all zero under a kernel that sums to zero", () => {
    const flat = [
      [4, 4, 4],
      [4, 4, 4],
      [4, 4, 4],
    ];
    const out = convolve3x3(flat, EDGE_DETECTION_KERNEL);
    for (const row of out) for (const value of row) expect(value).toBe(0);
  });
});

// ── downsample ───────────────────────────────────────────────────────────

describe("downsampleGrid", () => {
  it("box-averages a 4x4 grid down to 2x2 exactly", () => {
    const grid = [
      [1, 2, 3, 4],
      [5, 6, 7, 8],
      [9, 10, 11, 12],
      [13, 14, 15, 16],
    ];
    // top-left 2x2 block avg (1+2+5+6)/4=3.5; top-right (3+4+7+8)/4=5.5;
    // bottom-left (9+10+13+14)/4=11.5; bottom-right (11+12+15+16)/4=13.5.
    expect(downsampleGrid(grid, 2, 2)).toEqual([
      [3.5, 5.5],
      [11.5, 13.5],
    ]);
  });

  it("is a no-op identity when the target size equals the source size", () => {
    const grid = [
      [1, 2],
      [3, 4],
    ];
    expect(downsampleGrid(grid, 2, 2)).toEqual(grid);
  });
});

describe("downsampleRGB", () => {
  it("box-averages each channel independently", () => {
    const pixels = [
      [
        { r: 0, g: 0, b: 0 },
        { r: 10, g: 20, b: 30 },
      ],
      [
        { r: 20, g: 40, b: 60 },
        { r: 30, g: 60, b: 90 },
      ],
    ];
    // avg r=(0+10+20+30)/4=15; g=(0+20+40+60)/4=30; b=(0+30+60+90)/4=45.
    expect(downsampleRGB(pixels, 1, 1)).toEqual([[{ r: 15, g: 30, b: 45 }]]);
  });
});

// ── greyscale ────────────────────────────────────────────────────────────

describe("greyscaleValue", () => {
  it("applies the Rec. 601 luma weights exactly", () => {
    expect(greyscaleValue({ r: 255, g: 0, b: 0 })).toBeCloseTo(0.299 * 255, 10);
    expect(greyscaleValue({ r: 0, g: 255, b: 0 })).toBeCloseTo(0.587 * 255, 10);
    expect(greyscaleValue({ r: 0, g: 0, b: 255 })).toBeCloseTo(0.114 * 255, 10);
    expect(greyscaleValue({ r: 100, g: 150, b: 200 })).toBeCloseTo(140.75, 10);
  });
});

describe("greyscaleGrid", () => {
  it("maps every RGB cell through greyscaleValue", () => {
    const pixels = [[{ r: 255, g: 255, b: 255 }, { r: 0, g: 0, b: 0 }]];
    expect(greyscaleGrid(pixels)).toEqual([[255, 0]]);
  });
});
