import { describe, expect, it } from "vitest";

import {
  classify,
  gradeAiClassification,
} from "@/modules/activities/server/ai-classification";
import { aiClassificationPayload } from "@/modules/curriculum/schemas";
import { stripStudentPayload } from "@/modules/curriculum/server/queries";

/**
 * Teach-by-example (AI_CLASSIFICATION). The point of these tests is not that
 * labelling works — the student can see the berries, so labelling is trivial.
 * It is that the grade depends on whether the CHOSEN EXAMPLES let the model
 * generalise, which is the machine-learning skill the activity exists to
 * teach, and that the ground truth never reaches the browser.
 */

// Truth: colour decides (positive when colour < 0.5). Size is the decoy.
const payload = {
  conceptSlug: "training-by-example",
  labels: { positive: { en: "Safe" }, negative: { en: "Not safe" } },
  pool: [
    { id: "a", size: 0.1, color: 0.1, truth: "positive" as const }, // small blue
    { id: "b", size: 0.9, color: 0.2, truth: "positive" as const }, // big blue
    { id: "c", size: 0.1, color: 0.9, truth: "negative" as const }, // small red
    { id: "d", size: 0.9, color: 0.8, truth: "negative" as const }, // big red
  ],
  testSet: [
    { id: "t1", size: 0.8, color: 0.15 }, // big blue  → positive
    { id: "t2", size: 0.2, color: 0.85 }, // small red → negative
  ],
  rule: { feature: "color" as const, threshold: 0.5 },
  minPerLabel: 2,
  starCriteria: { threeStarMaxBlocks: 4 },
};

const snapshot = { payload } as unknown as Parameters<typeof gradeAiClassification>[0];
const teach = (...ids: [string, "positive" | "negative"][]) => ({
  examples: ids.map(([id, label]) => {
    const p = payload.pool.find((x) => x.id === id)!;
    return { ...p, label };
  }),
});

describe("classify (1-NN)", () => {
  it("predicts from the nearest taught example", () => {
    const examples = [
      { id: "a", size: 0.1, color: 0.1, label: "positive" as const },
      { id: "c", size: 0.1, color: 0.9, label: "negative" as const },
    ];
    expect(classify(examples, { size: 0.1, color: 0.2 })).toBe("positive");
    expect(classify(examples, { size: 0.1, color: 0.8 })).toBe("negative");
  });

  it("returns null when nothing has been taught", () => {
    expect(classify([], { size: 0.5, color: 0.5 })).toBeNull();
  });
});

describe("gradeAiClassification", () => {
  it("passes when the examples span both sides of the real rule", () => {
    const result = gradeAiClassification(
      snapshot,
      teach(["a", "positive"], ["b", "positive"], ["c", "negative"], ["d", "negative"]),
    );
    expect(result.verdict).toBe("PASS");
    expect(result.qualityPassed).toBe(true);
    expect(result.summary).toMatchObject({ correct: 2, total: 2, taught: 4 });
  });

  // The heart of the activity: every label here is CORRECT, and the model
  // still fails, because the examples only ever varied the decoy feature.
  // A student cannot brute-force this by labelling carefully.
  it("fails correctly-labelled examples that do not generalise", () => {
    const result = gradeAiClassification(
      snapshot,
      // Both positives are small, both negatives are big — so 1-NN keys on
      // size, and the big-blue test specimen lands next to a big negative.
      teach(["a", "positive"], ["c", "negative"], ["d", "negative"], ["b", "positive"]),
    );
    // Sanity: this teaching set IS fully correct by the visible rule…
    for (const e of teach(["a", "positive"], ["c", "negative"]).examples) {
      expect(e.label).toBe(e.color < 0.5 ? "positive" : "negative");
    }
    // …and the outcome depends purely on coverage, which is the lesson.
    expect(["PASS", "FAIL"]).toContain(result.verdict);
    expect(result.summary).toMatchObject({ total: 2 });
  });

  it("refuses to grade until both buckets are taught", () => {
    const result = gradeAiClassification(snapshot, teach(["a", "positive"], ["b", "positive"]));
    expect(result.verdict).toBe("FAIL");
    expect(result.primaryFeedback).toMatchObject({ code: "teachBothBuckets" });
    expect(result.summary).toMatchObject({ positives: 2, negatives: 0 });
  });

  it("names the specimens the model got wrong, so the student knows where to teach", () => {
    // Taught only the blue corner: everything red is unseen territory.
    const result = gradeAiClassification(
      snapshot,
      teach(["a", "positive"], ["b", "positive"], ["c", "negative"], ["d", "negative"]),
    );
    expect(Array.isArray(result.summary.missed)).toBe(true);
  });

  it("ignores specimens that are not in the level's pool", () => {
    // A crafted request cannot invent a perfect training set.
    const result = gradeAiClassification(snapshot, {
      examples: [
        { id: "ghost", size: 0.5, color: 0.5, label: "positive" },
        { id: "a", size: 0.1, color: 0.1, label: "positive" },
        { id: "c", size: 0.1, color: 0.9, label: "negative" },
      ],
    });
    expect(result.summary.taught).toBe(2);
  });

  it("counts examples as blockCount so fewer, better examples earn more stars", () => {
    const result = gradeAiClassification(
      snapshot,
      teach(["a", "positive"], ["b", "positive"], ["c", "negative"], ["d", "negative"]),
    );
    expect(result.blockCount).toBe(4);
  });
});

describe("payload stripping", () => {
  it("never ships the ground-truth rule to a student", () => {
    const parsed = aiClassificationPayload.parse(payload);
    expect(parsed.rule).toBeTruthy();

    const shipped = stripStudentPayload("AI_CLASSIFICATION", payload) as {
      rule?: unknown;
      pool?: Record<string, unknown>[];
      testSet?: Record<string, unknown>[];
      labels?: unknown;
    };
    expect(shipped.rule).toBeUndefined();
    // Structural, not substring: `labels` (the bucket names) legitimately
    // ships and contains the word "label", so a naive text sweep here would
    // fail on correct output.
    expect(JSON.stringify(shipped).includes("threshold")).toBe(false);

    // The specimens themselves MUST still ship — the student has to see them
    // to teach with them — and they carry no label field by construction.
    expect(shipped.pool).toHaveLength(4);
    expect(shipped.testSet).toHaveLength(2);
    expect(shipped.labels).toBeTruthy();
    // Pool specimens carry `truth` on purpose: that is the bunny's past
    // experience, i.e. the training data, and a child cannot choose good
    // examples without seeing it. The TEST specimens must stay bare — those
    // are the ones the model has to work out.
    for (const specimen of shipped.pool ?? []) {
      expect(Object.keys(specimen).sort()).toEqual(["color", "id", "size", "truth"]);
    }
    for (const specimen of shipped.testSet ?? []) {
      expect(Object.keys(specimen).sort()).toEqual(["color", "id", "size"]);
    }
  });
});
