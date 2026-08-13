import { describe, expect, it } from "vitest";

import {
  gradePatternRecognition,
  patternRecognitionAnswerSchema,
} from "@/modules/activities/server/pattern-recognition";
import { assign, centroid, lloydStep, runLloyd, spread, tightness } from "@/modules/ai/grouping";
import { patternRecognitionPayload } from "@/modules/curriculum/schemas";
import { stripStudentPayload } from "@/modules/curriculum/server/queries";
import type { LevelSnapshot } from "@/modules/curriculum/server/publish";

/**
 * The Grouping Machine, pinned to the EXACT numbers the curriculum design
 * was verified against. Every constant here was computed by running the real
 * functions in node before the levels were authored — if one of these tests
 * moves, an authored level's trap has moved with it, and a child somewhere
 * is either unable to lose (the level teaches nothing) or unable to win.
 */

const P = (size: number, color: number) => ({ size, color });

// two-piles: two clumps of six, means (0.25,0.30) and (0.75,0.70).
const TWO_PILES = [
  P(0.2, 0.26), P(0.28, 0.34), P(0.22, 0.38), P(0.3, 0.24), P(0.24, 0.3), P(0.26, 0.28),
  P(0.7, 0.66), P(0.78, 0.74), P(0.72, 0.78), P(0.8, 0.64), P(0.74, 0.7), P(0.76, 0.68),
];

describe("grouping mathematics", () => {
  it("assign: nearest marker wins; ties go to the lowest index", () => {
    const markers = [P(0.2, 0.2), P(0.8, 0.8)];
    expect(assign(P(0.1, 0.1), markers)).toBe(0);
    expect(assign(P(0.9, 0.9), markers)).toBe(1);
    // Exactly halfway: the earlier marker owns it, deterministically.
    expect(assign(P(0.5, 0.5), markers)).toBe(0);
  });

  it("centroid and spread agree with hand arithmetic", () => {
    expect(centroid([P(0, 0), P(1, 1)])).toEqual({ size: 0.5, color: 0.5 });
    expect(spread([P(0, 0), P(1, 1)], [P(0.5, 0.5)])).toBeCloseTo(1, 10);
  });

  it("tightness: two-piles reference geometry, the numbers the level ships on", () => {
    // Reference placement (the clump means).
    expect(tightness(TWO_PILES, [P(0.25, 0.3), P(0.75, 0.7)])).toBeCloseTo(0.9676, 4);
    // Deliberately sloppy but one flag per clump still clears a 0.75 bar —
    // the level is a judgement test, not a precision test.
    expect(tightness(TWO_PILES, [P(0.2, 0.24), P(0.8, 0.76)])).toBeCloseTo(0.91, 4);
    // One flag in the gap: far below the bar. The failure region is wide.
    expect(tightness(TWO_PILES, [P(0.15, 0.2), P(0.5, 0.5)])).toBeCloseTo(0.3894, 4);
    // Both flags inside one clump goes NEGATIVE — the maths must not clamp,
    // or two terrible answers would tie instead of ordering.
    expect(tightness(TWO_PILES, [P(0.24, 0.28), P(0.26, 0.32)])).toBeLessThan(0);
  });

  it("lloydStep: a flag that owns no specimens stays put", () => {
    const specimens = [P(0.1, 0.1), P(0.2, 0.2)];
    const markers = [P(0.15, 0.15), P(0.9, 0.9)];
    const next = lloydStep(specimens, markers);
    expect(next[1]).toEqual(P(0.9, 0.9));
  });

  it("runLloyd: let-it-run's two basins, exactly as authored", () => {
    const LR = [
      P(0.3, 0.34), P(0.14, 0.22), P(0.28, 0.2), P(0.16, 0.36),
      P(0.26, 0.3), P(0.18, 0.26), P(0.24, 0.24), P(0.2, 0.32),
      P(0.77, 0.74), P(0.67, 0.66), P(0.76, 0.65), P(0.68, 0.75),
      P(0.85, 0.49), P(0.75, 0.41), P(0.84, 0.4), P(0.76, 0.5),
    ];
    // One flag per clump converges to the clump means and wins.
    const good = runLloyd(LR, [P(0.2, 0.3), P(0.7, 0.7), P(0.8, 0.45)], 8);
    expect(tightness(LR, good)).toBeCloseTo(0.9534, 4);
    // Two flags seeded inside the big clump converge to a genuinely stable
    // local optimum: the big clump split, B and C merged. Better every step,
    // and still the wrong place — the entire lesson of the level.
    const bad = runLloyd(LR, [P(0.18, 0.24), P(0.26, 0.32), P(0.75, 0.6)], 8);
    expect(tightness(LR, bad)).toBeCloseTo(0.8859, 4);
    // The kicker: a sloppy seed READS worse than the bad seed before
    // training (0.4635 vs 0.8779) and wins after it.
    expect(tightness(LR, [P(0.05, 0.05), P(0.6, 0.62), P(0.95, 0.35)])).toBeCloseTo(0.4635, 4);
    expect(tightness(LR, [P(0.18, 0.24), P(0.26, 0.32), P(0.75, 0.6)])).toBeCloseTo(0.8779, 4);
    const sloppy = runLloyd(LR, [P(0.05, 0.05), P(0.6, 0.62), P(0.95, 0.35)], 8);
    expect(tightness(LR, sloppy)).toBeCloseTo(0.9534, 4);
  });
});

// A minimal valid payload around the two-piles geometry.
const payload = {
  conceptSlug: "grouping",
  specimens: TWO_PILES.map((s, i) => ({ id: `s${i}`, ...s })),
  markers: { min: 2, max: 2 },
  maxExclusions: 0,
  objective: { minTightness: 0.75 },
  groundTruth: {
    referencePlacement: [P(0.25, 0.3), P(0.75, 0.7)],
    hiddenKinds: Object.fromEntries(TWO_PILES.map((_, i) => [`s${i}`, i < 6 ? 0 : 1])),
    kindNames: [{ en: "Jerboa" }, { en: "Fennec fox" }],
  },
  starCriteria: {},
};
const snapshot = { payload } as unknown as LevelSnapshot;

describe("gradePatternRecognition", () => {
  it("passes a sane placement and reveals the kinds ONLY then", () => {
    const result = gradePatternRecognition(snapshot, {
      markers: [P(0.25, 0.3), P(0.75, 0.7)],
      excluded: [],
    });
    expect(result.verdict).toBe("PASS");
    expect(result.primaryFeedback).toMatchObject({ code: "kindsRevealed" });
    const data = result.primaryFeedback!.data as { kinds: Record<string, number> };
    expect(data.kinds.s0).toBe(0);
    expect(data.kinds.s11).toBe(1);
  });

  it("fails a flag in the gap, with the score in words the player can show", () => {
    const result = gradePatternRecognition(snapshot, {
      markers: [P(0.15, 0.2), P(0.5, 0.5)],
      excluded: [],
    });
    expect(result.verdict).toBe("FAIL");
    expect(result.primaryFeedback).toMatchObject({
      code: "pilesNotTight",
      data: { score: 39, need: 75 },
    });
  });

  it("refuses a marker count outside the level's budget", () => {
    const result = gradePatternRecognition(snapshot, {
      markers: [P(0.5, 0.5)],
      excluded: [],
    });
    expect(result.primaryFeedback).toMatchObject({ code: "wrongMarkerCount" });
  });

  it("refuses a flag that owns nothing (the pile-them-up degenerate)", () => {
    const result = gradePatternRecognition(snapshot, {
      // Both flags in one clump: the far clump's flag... both own specimens
      // here, so use a flag pushed into the corner beyond everything.
      markers: [P(0.5, 0.5), P(0.51, 0.5)],
      excluded: [],
    });
    // Every specimen is nearer one of the two central flags than the other
    // by tiny margins — construct a genuinely empty flag instead:
    const result2 = gradePatternRecognition(snapshot, {
      markers: [P(0.5, 0.49), P(1, 0)],
      excluded: [],
    });
    // At least one of the two constructions must exhibit an empty flag;
    // assert on the explicit one.
    expect(
      [result, result2].some(
        (r) => r.primaryFeedback && r.primaryFeedback.code === "emptyMarker",
      ),
    ).toBe(true);
  });

  it("ignores excluded ids that do not exist, and enforces the budget", () => {
    const result = gradePatternRecognition(snapshot, {
      markers: [P(0.25, 0.3), P(0.75, 0.7)],
      excluded: ["ghost"],
    });
    // ghost is filtered, budget 0 not exceeded, grading proceeds → PASS.
    expect(result.verdict).toBe("PASS");

    const over = gradePatternRecognition(snapshot, {
      markers: [P(0.25, 0.3), P(0.75, 0.7)],
      excluded: ["s0", "s1"],
    });
    expect(over.primaryFeedback).toMatchObject({ code: "tooManyExclusions" });
  });

  it("replays the training loop from the seed on training levels", () => {
    const LR = [
      P(0.3, 0.34), P(0.14, 0.22), P(0.28, 0.2), P(0.16, 0.36),
      P(0.26, 0.3), P(0.18, 0.26), P(0.24, 0.24), P(0.2, 0.32),
      P(0.77, 0.74), P(0.67, 0.66), P(0.76, 0.65), P(0.68, 0.75),
      P(0.85, 0.49), P(0.75, 0.41), P(0.84, 0.4), P(0.76, 0.5),
    ];
    const trainingSnapshot = {
      payload: {
        conceptSlug: "training-loop",
        specimens: LR.map((s, i) => ({ id: `r${i}`, ...s })),
        markers: { min: 3, max: 3 },
        maxExclusions: 0,
        objective: { minTightness: 0.92 },
        training: { kind: "lloyd", iterations: 8 },
        groundTruth: { referencePlacement: [P(0.22, 0.28), P(0.72, 0.7), P(0.8, 0.45)] },
        starCriteria: {},
      },
    } as unknown as LevelSnapshot;

    // The sloppy seed that READS 46% at submit time wins after training.
    const sloppy = gradePatternRecognition(trainingSnapshot, {
      markers: [P(0.05, 0.05), P(0.6, 0.62), P(0.95, 0.35)],
      excluded: [],
    });
    expect(sloppy.verdict).toBe("PASS");
    expect(sloppy.summary.score as number).toBeCloseTo(0.9534, 4);

    // The tidy-looking seed that converges into the wrong basin loses.
    const trapped = gradePatternRecognition(trainingSnapshot, {
      markers: [P(0.18, 0.24), P(0.26, 0.32), P(0.75, 0.6)],
      excluded: [],
    });
    expect(trapped.verdict).toBe("FAIL");
    expect(trapped.summary.score as number).toBeCloseTo(0.8859, 4);
  });

  it("withholds the third star above the flag budget", () => {
    const budgeted = {
      payload: { ...payload, markers: { min: 2, max: 4 }, starCriteria: { threeStarMaxBlocks: 2 } },
    } as unknown as LevelSnapshot;
    const three = gradePatternRecognition(budgeted, {
      markers: [P(0.25, 0.3), P(0.7, 0.66), P(0.8, 0.74)],
      excluded: [],
    });
    expect(three.verdict).toBe("PASS");
    expect(three.qualityPassed).toBe(false);
    const two = gradePatternRecognition(budgeted, {
      markers: [P(0.25, 0.3), P(0.75, 0.7)],
      excluded: [],
    });
    expect(two.qualityPassed).toBe(true);
  });
});

describe("what ships to the student", () => {
  it("never ships groundTruth, and the student mirror accepts the strip", () => {
    const parsed = patternRecognitionPayload.parse(payload);
    expect(parsed.groundTruth).toBeTruthy();
    const shipped = stripStudentPayload("PATTERN_RECOGNITION", payload) as Record<string, unknown>;
    expect(shipped.groundTruth).toBeUndefined();
    expect(JSON.stringify(shipped).includes("referencePlacement")).toBe(false);
    expect(JSON.stringify(shipped).includes("hiddenKinds")).toBe(false);
  });

  it("rejects off-grid marker coordinates at the wire", () => {
    expect(
      patternRecognitionAnswerSchema.safeParse({
        markers: [{ size: 0.123, color: 0.5 }],
        excluded: [],
      }).success,
    ).toBe(false);
    expect(
      patternRecognitionAnswerSchema.safeParse({
        markers: [{ size: 0.12, color: 0.5 }],
        excluded: [],
      }).success,
    ).toBe(true);
  });
});
