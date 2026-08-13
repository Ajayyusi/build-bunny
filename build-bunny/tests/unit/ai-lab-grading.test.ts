import { describe, expect, it } from "vitest";

import { getAiSimWidgetEngine } from "@/modules/ai/lab/registry";

/**
 * Grading coverage for the three AI_SIM widgets, driven entirely through the
 * public registry seam (getAiSimWidgetEngine) exactly as the AI_SIM activity
 * adapter (src/modules/activities/server/ai-sim.ts) calls it — never the
 * per-widget grade() functions directly, so this also exercises the
 * config.safeParse belt-and-suspenders re-validation each engine does.
 */

// ── boundary-builder ───────────────────────────────────────────────────────
// 8 points, separable by y=0 (cat below, dog above); maxErrors=1.
// partialLimit = maxErrors(1) + max(1, ceil(8*0.2)=2) = 3.

describe("boundary-builder grading", () => {
  const engine = getAiSimWidgetEngine("boundary-builder")!;
  const baseConfig = {
    widgetId: "boundary-builder" as const,
    xAxis: { en: "x" },
    yAxis: { en: "y" },
    labels: [
      { id: "cat", text: { en: "Cat" } },
      { id: "dog", text: { en: "Dog" } },
    ],
    maxErrors: 1,
    points: [
      { id: "c1", x: 0, y: -3, label: "cat" },
      { id: "c2", x: 1, y: -2, label: "cat" },
      { id: "c3", x: -1, y: -1, label: "cat" },
      { id: "c4", x: 2, y: -4, label: "cat" },
      { id: "d1", x: 0, y: 3, label: "dog" },
      { id: "d2", x: 1, y: 2, label: "dog" },
      { id: "d3", x: -1, y: 1, label: "dog" },
      { id: "d4", x: 2, y: 4, label: "dog" },
    ],
  };

  it("PASS + 3 stars: a perfectly separating line (0 errors)", () => {
    const result = engine.grade(baseConfig, { line: { slope: 0, intercept: 0 } });
    expect(result.verdict).toBe("PASS");
    expect(result.qualityPassed).toBe(true);
    expect(result.primaryFeedback).toBeNull();
    expect(result.summary.errors).toBe(0);
  });

  it("PASS but not 3 stars: exactly maxErrors (1) misclassified point", () => {
    const config = {
      ...baseConfig,
      points: baseConfig.points.map((p) => (p.id === "d4" ? { ...p, y: -0.5 } : p)),
    };
    const result = engine.grade(config, { line: { slope: 0, intercept: 0 } });
    expect(result.verdict).toBe("PASS");
    expect(result.qualityPassed).toBe(false);
    expect(result.summary.errors).toBe(1);
    expect(result.summary.misclassifiedIds).toEqual(["d4"]);
  });

  it("PARTIAL: 3 misclassified points (within the generous cushion)", () => {
    const config = {
      ...baseConfig,
      points: baseConfig.points.map((p) =>
        ["d1", "d3", "d4"].includes(p.id) ? { ...p, y: -Math.abs(p.y) } : p,
      ),
    };
    const result = engine.grade(config, { line: { slope: 0, intercept: 0 } });
    expect(result.verdict).toBe("PARTIAL");
    expect(result.qualityPassed).toBe(false);
    expect(result.summary.errors).toBe(3);
    expect(result.primaryFeedback).toEqual({
      code: "classifierErrors",
      data: { errors: 3, maxErrors: 1 },
    });
  });

  it("FAIL: 4 misclassified points (past the cushion)", () => {
    const config = {
      ...baseConfig,
      points: baseConfig.points.map((p) =>
        ["d1", "d2", "d3", "d4"].includes(p.id) ? { ...p, y: -Math.abs(p.y) } : p,
      ),
    };
    const result = engine.grade(config, { line: { slope: 0, intercept: 0 } });
    expect(result.verdict).toBe("FAIL");
    expect(result.summary.errors).toBe(4);
  });

  it("ERROR on a malformed submission (missing line)", () => {
    const result = engine.grade(baseConfig, { notALine: true });
    expect(result.verdict).toBe("ERROR");
    expect(result.qualityPassed).toBe(false);
  });

  it("stripConfig is the identity — nothing in this widget's config is answer-bearing", () => {
    expect(engine.stripConfig(baseConfig)).toEqual(baseConfig);
  });
});

// ── trend-line ───────────────────────────────────────────────────────────
// points chosen so the least-squares optimum is a clean {slope:0, intercept:0.4},
// optimumSSE=1.2 exactly (hand-derivation in the comments below).

describe("trend-line grading", () => {
  const engine = getAiSimWidgetEngine("trend-line")!;
  const config = {
    widgetId: "trend-line" as const,
    xAxis: { en: "x" },
    yAxis: { en: "y" },
    toleranceFactor: 1.6,
    predictAt: 10,
    points: [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 0 },
      { x: 3, y: 1 },
      { x: 4, y: 0 },
    ],
  };
  // sumX=10 sumY=2 sumXY=4 sumXX=30 n=5; denom=5*30-100=50;
  // slope=(5*4-10*2)/50=0; intercept=(2-0)/5=0.4. optimumSSE = Σ(y-0.4)² =
  // 0.16+0.36+0.16+0.36+0.16 = 1.2.
  // passThreshold=1.2*1.6=1.92; partialThreshold=1.92*1.5=2.88; star3=1.2*1.15=1.38.

  it("PASS + 3 stars: submits the exact optimum line", () => {
    const result = engine.grade(config, {
      line: { slope: 0, intercept: 0.4 },
      prediction: 0.4,
    });
    expect(result.verdict).toBe("PASS");
    expect(result.qualityPassed).toBe(true);
    expect(result.summary.childSSE).toBe(1.2);
    expect(result.summary.optimumSSE).toBe(1.2);
  });

  it("PASS but not 3 stars: childSSE=1.4 (above the 1.38 star band, within the 1.92 pass line)", () => {
    // line intercept=0.6: residuals -0.6,+0.4,-0.6,+0.4,-0.6 → squares
    // 0.36,0.16,0.36,0.16,0.36 = 1.4.
    const result = engine.grade(config, {
      line: { slope: 0, intercept: 0.6 },
      prediction: 0.6,
    });
    expect(result.verdict).toBe("PASS");
    expect(result.qualityPassed).toBe(false);
    expect(result.summary.childSSE).toBe(1.4);
  });

  it("PARTIAL: childSSE=2.0 (between the pass line and the partial cushion)", () => {
    // line intercept=0.8: residuals -0.8,+0.2,-0.8,+0.2,-0.8 → squares
    // 0.64,0.04,0.64,0.04,0.64 = 2.0.
    const result = engine.grade(config, {
      line: { slope: 0, intercept: 0.8 },
      prediction: 0.8,
    });
    expect(result.verdict).toBe("PARTIAL");
    expect(result.summary.childSSE).toBe(2);
    expect(result.primaryFeedback).toEqual({
      code: "trendMissTooHigh",
      data: { childScore: 2, targetScore: 1.92 },
    });
  });

  it("FAIL: childSSE=14 (far past the partial cushion)", () => {
    // line intercept=2.0: residuals -2,-1,-2,-1,-2 → squares 4,1,4,1,4 = 14.
    const result = engine.grade(config, {
      line: { slope: 0, intercept: 2 },
      prediction: 2,
    });
    expect(result.verdict).toBe("FAIL");
    expect(result.summary.childSSE).toBe(14);
  });

  it("reports an honest prediction error band around the TRUE optimum, not the child's line", () => {
    // fittedPrediction = 0*10+0.4 = 0.4; residualStd=sqrt(1.2/5)=0.4898994...;
    // band = 0.4 ± 1.5*0.4899 = [-0.3348..., 1.1348...] → rounded [-0.33, 1.13].
    const inBand = engine.grade(config, {
      line: { slope: 0, intercept: 0.4 },
      prediction: 0.5,
    });
    expect(inBand.summary.band).toEqual({ low: -0.33, high: 1.13 });
    expect(inBand.summary.fittedPrediction).toBe(0.4);
    expect(inBand.summary.predictionInBand).toBe(true);

    const outOfBand = engine.grade(config, {
      line: { slope: 0, intercept: 0.4 },
      prediction: 5,
    });
    expect(outOfBand.summary.predictionInBand).toBe(false);
  });

  it("ERROR on a malformed submission (prediction missing)", () => {
    const result = engine.grade(config, { line: { slope: 0, intercept: 0.4 } });
    expect(result.verdict).toBe("ERROR");
  });

  it("stripConfig is the identity — points and predictAt are the exercise itself", () => {
    expect(engine.stripConfig(config)).toEqual(config);
  });
});

// ── pixel-playground ─────────────────────────────────────────────────────

describe("pixel-playground grading", () => {
  const engine = getAiSimWidgetEngine("pixel-playground")!;
  const config = {
    widgetId: "pixel-playground" as const,
    images: [
      { id: "rabbit", src: "/ai-lab/rabbit.svg", name: { en: "Rabbit" } },
      { id: "carrot", src: "/ai-lab/carrot.svg", name: { en: "Carrot" } },
    ],
    resolutions: [32, 16],
    rounds: [
      { id: "r1", imageId: "rabbit", resolution: 16 },
      { id: "r2", imageId: "carrot", resolution: 16 },
      { id: "r3", imageId: "rabbit", resolution: 32 },
      { id: "r4", imageId: "carrot", resolution: 32 },
    ],
  };

  it("PASS + 3 stars: every round identified correctly", () => {
    const result = engine.grade(config, {
      rounds: { r1: "rabbit", r2: "carrot", r3: "rabbit", r4: "carrot" },
    });
    expect(result.verdict).toBe("PASS");
    expect(result.qualityPassed).toBe(true);
    expect(result.summary.correct).toBe(4);
  });

  it("PARTIAL: exactly half correct (the ceil(total/2) boundary)", () => {
    const result = engine.grade(config, {
      rounds: { r1: "rabbit", r2: "carrot", r3: "carrot", r4: "rabbit" },
    });
    expect(result.verdict).toBe("PARTIAL");
    expect(result.qualityPassed).toBe(false);
    expect(result.summary.correct).toBe(2);
    expect(result.primaryFeedback).toEqual({ code: "mysteryRoundsWrong", data: { correct: 2, total: 4 } });
  });

  it("FAIL: only one of four correct", () => {
    const result = engine.grade(config, {
      rounds: { r1: "rabbit", r2: "rabbit", r3: "carrot", r4: "rabbit" },
    });
    expect(result.verdict).toBe("FAIL");
    expect(result.summary.correct).toBe(1);
  });

  it("ERROR on a malformed submission (rounds not a record)", () => {
    const result = engine.grade(config, { rounds: "nope" });
    expect(result.verdict).toBe("ERROR");
  });

  it("stripConfig hides each round's imageId (the answer) but keeps its pixels (src)", () => {
    const stripped = engine.stripConfig(config) as {
      rounds: { id: string; src: string }[];
      images: { id: string }[];
    };
    expect(stripped.rounds).toHaveLength(4);
    for (const round of stripped.rounds) {
      expect(round).not.toHaveProperty("imageId");
      expect(round.src.length).toBeGreaterThan(0);
    }
    // The multiple-choice image list itself stays fully visible.
    expect(stripped.images.map((i) => i.id)).toEqual(["rabbit", "carrot"]);
  });

  it("no round's src matches an option's src — the answer is not readable from the payload", () => {
    const stripped = engine.stripConfig(config) as {
      rounds: { id: string; src: string }[];
      images: { id: string; src: string }[];
    };
    const optionSrcs = new Set(stripped.images.map((image) => image.src));
    for (const round of stripped.rounds) {
      // Stripping imageId is pointless if src still string-matches the
      // option it came from — that was a real DevTools answer leak.
      expect(optionSrcs.has(round.src)).toBe(false);
      expect(round.src.startsWith("data:image/svg+xml;base64,")).toBe(true);
    }
    // Two rounds of the same image inline identically; that only reveals
    // "these two are the same", never WHICH image they are.
    expect(stripped.rounds[0]!.src).toBe(stripped.rounds[2]!.src);
    expect(stripped.rounds[0]!.src).not.toBe(stripped.rounds[1]!.src);
  });

  it("falls back to the plain path when an asset cannot be inlined", () => {
    const missing = {
      ...config,
      images: [
        { id: "ghost", src: "/ai-lab/does-not-exist.svg", name: { en: "Ghost" } },
        { id: "carrot", src: "/ai-lab/carrot.svg", name: { en: "Carrot" } },
      ],
      rounds: [{ id: "r1", imageId: "ghost", resolution: 16 }],
    };
    const stripped = engine.stripConfig(missing) as { rounds: { src: string }[] };
    // Degrade the puzzle, never break the level.
    expect(stripped.rounds[0]!.src).toBe("/ai-lab/does-not-exist.svg");
  });
});

// ── unknown widget id ────────────────────────────────────────────────────

describe("getAiSimWidgetEngine", () => {
  it("returns undefined for an id outside AI_SIM_WIDGETS", () => {
    expect(getAiSimWidgetEngine("not-a-widget")).toBeUndefined();
  });
});
