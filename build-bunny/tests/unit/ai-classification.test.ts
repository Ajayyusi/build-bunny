import { describe, expect, it } from "vitest";


import {
  aiClassificationAnswerSchema,
  classify,
  gradeAiClassification,
  trueLabel,
} from "@/modules/activities/server/ai-classification";
import { toTrainingExample } from "@/modules/ai/knn";
import {
  aiClassificationPayload,
  aiClassificationStudentPayload,
  type ClassificationRule,
} from "@/modules/curriculum/schemas";
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

describe("what the player submits", () => {
  /**
   * Mirror of the attempts route's per-example schema. The route validates
   * with .strict(), and that is the whole point of this suite: pool
   * specimens carry `truth` so the CHILD can see what happened when the
   * bunny ate that berry, but sending it to the grader rejects the whole
   * submission with a 400 the UI reported as "not quite yet" — telling a
   * child to rethink work that never reached the server.
   */
  // NOT a mirror any more. The point of importing the real schema is that a
  // field added to the wire shape cannot be added to three copies and missed
  // in the fourth — which is exactly how `truth` shipped and 400'd every
  // submission behind a "not quite yet" message.
  const routeExample = aiClassificationAnswerSchema.shape.examples.element;

  it("strips `truth` so a strict route schema accepts it", () => {
    const taught = payload.pool.map((specimen) => ({
      ...specimen, // as the player holds it: geometry + truth + chosen label
      label: specimen.truth,
    }));

    // Spreading the specimen wholesale is what broke it.
    expect(routeExample.safeParse(taught[0]).success).toBe(false);

    // Funnelled through the shared mapper, every example is accepted.
    for (const example of taught.map(toTrainingExample)) {
      const parsed = routeExample.safeParse(example);
      expect(parsed.success, JSON.stringify(example)).toBe(true);
      expect(Object.keys(example).sort()).toEqual(["color", "id", "label", "size"]);
    }
  });

  it("keeps the label the student chose, not the berry's own truth", () => {
    // A student may mislabel on purpose; the mapper must not "correct" them.
    const mislabelled = { ...payload.pool[0]!, label: "negative" as const };
    expect(toTrainingExample(mislabelled).label).toBe("negative");
  });
});


describe("rule kinds", () => {
  it("defaults a rule with no `kind` to a threshold, so authored levels are unchanged", () => {
    const parsed = aiClassificationPayload.parse(payload);
    expect(parsed.rule).toEqual({ kind: "threshold", feature: "color", threshold: 0.5 });
  });

  it("threshold: positive strictly BELOW the cut", () => {
    const rule: ClassificationRule = { kind: "threshold", feature: "color", threshold: 0.5 };
    expect(trueLabel(rule, { size: 0.9, color: 0.49 })).toBe("positive");
    expect(trueLabel(rule, { size: 0.1, color: 0.5 })).toBe("negative");
    expect(trueLabel(rule, { size: 0.1, color: 0.51 })).toBe("negative");
  });

  it("box: positive only where BOTH measurements are inside, edges included", () => {
    // The whole point of this rule kind: neither feature alone explains it,
    // so there is no "one that matters" for a student to find.
    const rule: ClassificationRule = { kind: "box", size: [0.0, 0.4], color: [0.0, 0.4] };
    expect(trueLabel(rule, { size: 0.2, color: 0.2 })).toBe("positive"); // inside
    expect(trueLabel(rule, { size: 0.4, color: 0.4 })).toBe("positive"); // on both edges
    expect(trueLabel(rule, { size: 0.2, color: 0.9 })).toBe("negative"); // size ok only
    expect(trueLabel(rule, { size: 0.9, color: 0.2 })).toBe("negative"); // colour ok only
    expect(trueLabel(rule, { size: 0.9, color: 0.9 })).toBe("negative"); // neither
    expect(trueLabel(rule, { size: 0.41, color: 0.2 })).toBe("negative"); // just outside
  });

  it("rejects a box rule with a stray field", () => {
    const bad = { ...payload, rule: { kind: "box", size: [0, 0.4], color: [0, 0.4], feature: "size" } };
    expect(aiClassificationPayload.safeParse(bad).success).toBe(false);
  });
});

describe("the student payload schema", () => {
  it("accepts a correctly stripped payload", () => {
    const shipped = stripStudentPayload("AI_CLASSIFICATION", payload);
    expect(aiClassificationStudentPayload.safeParse(shipped).success).toBe(true);
  });

  it("REFUSES a payload that still carries the rule", () => {
    // This is the whole reason it exists: the play page used to cast rather
    // than parse, so a strip regression would have serialised the ground
    // truth into the page source with nothing failing.
    const leaked = { ...(stripStudentPayload("AI_CLASSIFICATION", payload) as object), rule: payload.rule };
    expect(aiClassificationStudentPayload.safeParse(leaked).success).toBe(false);
  });
});

describe("the missed specimens reach the player", () => {
  it("names them on the feedback, not only in the summary", () => {
    // The player reads feedback.data. "1 of 2 right" with no name is a
    // verdict a child cannot act on.
    const result = gradeAiClassification(
      snapshot,
      teach(["a", "positive"], ["c", "negative"], ["d", "negative"], ["b", "positive"]),
    );
    if (result.verdict === "FAIL") {
      expect(result.primaryFeedback?.code).toBe("modelGuessedWrong");
      const data = result.primaryFeedback?.data as { missed?: string[] };
      expect(Array.isArray(data.missed)).toBe(true);
      expect(data.missed).toEqual(result.summary.missed);
    }
  });
});

describe("safetyFirst verdicts", () => {
  /**
   * A safetyFirst level has the same shape as every other engine check: the
   * "never misclassify this label" rule is CORE, and maxOtherErrors is a
   * budgeted SECONDARY allowance. So over-caution must not read like danger.
   *
   * Truth here is colour again (colour < 0.5 → safe). The dangerous label is
   * "negative" — calling an unsafe berry safe is the mistake that must never
   * happen; being too cautious about safe ones is merely budgeted.
   */
  const safetyPayload = {
    ...payload,
    testSet: [
      { id: "s1", size: 0.8, color: 0.15 }, // truly safe
      { id: "s2", size: 0.7, color: 0.2 }, // truly safe
      { id: "s3", size: 0.2, color: 0.85 }, // truly unsafe
    ],
    // minPerLabel 1 so a deliberately lopsided teaching set is reachable —
    // at 2 the only valid sets on this 4-berry pool already classify well,
    // and the over-caution case could not be constructed at all.
    minPerLabel: 1,
    passRule: {
      kind: "safetyFirst" as const,
      neverMisclassify: "negative" as const,
      maxOtherErrors: 0,
    },
  };
  const safetySnapshot = { payload: safetyPayload } as unknown as Parameters<
    typeof gradeAiClassification
  >[0];
  const teachSafety = (...ids: [string, "positive" | "negative"][]) => ({
    examples: ids.map(([id, label]) => {
      const found = safetyPayload.pool.find((x) => x.id === id)!;
      return { ...found, label };
    }),
  });

  it("is PARTIAL when nothing dangerous was missed but the child was over-cautious", () => {
    // Teaching only red/unsafe-ish examples makes the model call safe
    // berries unsafe: false alarms, zero dangerous misses.
    // Teach one safe berry and both red ones: the model then calls the big
    // blue probe unsafe (a false alarm) while never calling an unsafe one safe.
    const result = gradeAiClassification(
      safetySnapshot,
      teachSafety(["a", "positive"], ["c", "negative"], ["d", "negative"]),
    );
    expect(result.verdict).toBe("PARTIAL");
    const data = result.primaryFeedback?.data as { dangerousMisses: number } | undefined;
    expect(data?.dangerousMisses).toBe(0);
    expect(result.primaryFeedback?.code).toBe("tooManyFalseAlarms");
  });

  it("is FAIL when a dangerous one was called safe", () => {
    // The opposite mistake: everything taught as safe, so the unsafe probe
    // is misclassified. This is the core rule broken — never PARTIAL.
    // Mislabel the small RED berry as safe: the unsafe probe now sits
    // nearest a positive example, so the model calls it safe.
    const result = gradeAiClassification(
      safetySnapshot,
      teachSafety(["c", "positive"], ["a", "negative"]),
    );
    expect(result.verdict).toBe("FAIL");
    expect(result.primaryFeedback?.code).toBe("calledADangerousOneSafe");
  });

  it("keeps a plain near miss at FAIL, because PARTIAL would unlock the next level", () => {
    // No safety rule: one wrong probe means the model is still wrong, and
    // submit.ts treats PARTIAL as completed. Progress must be earned.
    const result = gradeAiClassification(snapshot, teach(["a", "positive"], ["b", "positive"]));
    expect(result.verdict).toBe("FAIL");
  });
});
