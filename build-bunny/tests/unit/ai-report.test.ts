import { describe, expect, it } from "vitest";

import { caseStatuses, reportableCases } from "@/modules/ai/report";
import { gradeAiClassification } from "@/modules/activities/server/ai-classification";
import { aiClassificationPayload, aiClassificationStudentPayload } from "@/modules/curriculum/schemas";
import { stripStudentPayload } from "@/modules/curriculum/server/queries";
import type { LevelSnapshot } from "@/modules/curriculum/server/publish";
import { computeNextStep } from "@/modules/hints/server/next-step";
import { getActivityEngine } from "@/modules/activities/server/registry";

import { bundle } from "../../content";

/**
 * The AI project capstone (handoff: "build a classifier, test unseen cases,
 * report one failure and a human safeguard"). The report is checked by the
 * same rule the player marks cases with.
 */

const level = bundle.worlds.flatMap((w) => w.modules.flatMap((m) => m.levels)).find((l) => l.slug === "my-ai-project")!;
const payload = aiClassificationPayload.parse(level.payload);
const snapshot = { payload: level.payload } as unknown as LevelSnapshot;
const byId = new Map(payload.pool.map((s) => [s.id, s]));
const asExamples = (ids: string[]) => ids.map((id) => ({ id, size: byId.get(id)!.size, color: byId.get(id)!.color, label: byId.get(id)!.truth }));
const held = (ids: string[]) => ids.map((id) => byId.get(id)!);

// A model that passes the fair's test, and a test pile with near-the-line
// berries in it (b4, b9) and one far from the line (b1).
const TAUGHT = ["b2", "b3", "b5", "b6", "b7", "b8", "b10"];
const PILE = ["b1", "b4", "b9"];

describe("which cases a report may name", () => {
  const examples = [
    { id: "a", size: 0.2, color: 0.2, label: "positive" as const },
    { id: "b", size: 0.2, color: 0.8, label: "negative" as const },
  ];

  it("counts a wrong case and a close call, not a sure right one", () => {
    const statuses = caseStatuses(examples, [
      { id: "wrong", size: 0.2, color: 0.3, truth: "negative" },
      { id: "close", size: 0.2, color: 0.49, truth: "positive" },
      { id: "sure", size: 0.2, color: 0.1, truth: "positive" },
    ]);
    expect(statuses).toEqual({ wrong: "wrong", close: "closeCall", sure: "right" });
  });

  it("when every case is right and sure, the least sure one is the report", () => {
    const pile = [
      { id: "far", size: 0.2, color: 0.05, truth: "positive" as const },
      { id: "nearer", size: 0.2, color: 0.35, truth: "positive" as const },
    ];
    expect(caseStatuses(examples, pile)).toEqual({ far: "right", nearer: "leastSure" });
    expect(reportableCases(examples, pile)).toEqual(["nearer"]);
  });

  it("has nothing to report before both baskets are taught", () => {
    expect(reportableCases([examples[0]!], [{ id: "x", size: 0.5, color: 0.5, truth: "positive" }])).toEqual([]);
  });
});

describe("the project report is graded after the model", () => {
  const grade = (report?: { caseId: string; safeguardId: string }) =>
    gradeAiClassification(snapshot, { examples: asExamples(TAUGHT), checkSet: PILE, ...(report ? { report } : {}) });
  const failure = () => reportableCases(asExamples(TAUGHT), held(PILE))[0]!;

  it("the model on its own passes the fair's test", () => {
    expect(failure()).toBeDefined();
    expect(grade().primaryFeedback).toMatchObject({ code: "needReport", data: { correct: 4, total: 4 } });
    expect(grade().verdict).toBe("FAIL");
  });

  it("a case the model got right and was sure about isn't a failure", () => {
    expect(caseStatuses(asExamples(TAUGHT), held(PILE)).b1).toBe("right");
    expect(grade({ caseId: "b1", safeguardId: "person-checks" }).primaryFeedback).toMatchObject({ code: "reportNotAFailure" });
  });

  it("a case outside the child's own test pile can't be reported", () => {
    expect(grade({ caseId: "f1", safeguardId: "person-checks" }).primaryFeedback).toMatchObject({ code: "reportNotAFailure" });
  });

  it("trusting the robot, or hiding its mistakes, isn't a safeguard", () => {
    for (const safeguardId of ["trust-it", "hide-mistakes"]) {
      expect(grade({ caseId: failure(), safeguardId }).primaryFeedback).toMatchObject({ code: "safeguardNotSafe" });
    }
  });

  it("a real failure and a safe safeguard pass, and the report is saved with the attempt", () => {
    for (const safeguardId of ["person-checks", "keep-testing"]) {
      const result = grade({ caseId: failure(), safeguardId });
      expect(result.verdict).toBe("PASS");
      expect(result.summary.report).toEqual({ caseId: failure(), safeguardId });
    }
  });

  it("a model that fails the test is reported as that, not as a missing report", () => {
    const result = gradeAiClassification(snapshot, {
      // No purple berry on the left taught as ripe: f4 comes out wrong.
      examples: asExamples(["b1", "b4", "b7", "b10"]),
      checkSet: ["b2", "b5", "b9"],
      report: { caseId: "b9", safeguardId: "person-checks" },
    });
    expect(result.verdict).toBe("FAIL");
    expect(result.primaryFeedback?.code).toBe("modelGuessedWrong");
  });

  it("the route's body schema accepts a report and nothing extra", () => {
    const engine = getActivityEngine("AI_CLASSIFICATION")!;
    const base = { examples: asExamples(TAUGHT), checkSet: PILE };
    expect(engine.grade(snapshot, { ...base, report: { caseId: failure(), safeguardId: "keep-testing", extra: 1 } }).verdict).toBe("ERROR");
  });
});

describe("the safeguards ship without their answers", () => {
  it("strips `safe` and the student mirror rejects a leak", () => {
    const shipped = stripStudentPayload("AI_CLASSIFICATION", level.payload) as { report: { safeguards: object[] } };
    expect(JSON.stringify(shipped.report)).not.toContain('"safe"');
    expect(shipped.report.safeguards).toHaveLength(4);
    expect(aiClassificationStudentPayload.safeParse(shipped).success).toBe(true);
    expect(aiClassificationStudentPayload.safeParse({ ...shipped, report: (level.payload as { report: unknown }).report }).success).toBe(false);
  });

  it("the report needs the child's own test pile", () => {
    expect(payload.holdout).toBeDefined();
    expect(payload.report!.safeguards.some((s) => s.safe)).toBe(true);
    expect(payload.report!.safeguards.some((s) => !s.safe)).toBe(true);
  });
});

describe("Show me the next step, through the report", () => {
  const passes = (answer: unknown) => {
    const g = gradeAiClassification(snapshot, answer as never);
    return { pass: g.verdict === "PASS", top: g.verdict === "PASS" && g.qualityPassed };
  };
  const examples = TAUGHT.map((id) => ({ id, label: byId.get(id)!.truth }));

  it("asks for the case, then the safeguard, then says it's ready", () => {
    const state = { examples, held: PILE, revealed: true, report: { caseId: null as string | null, safeguardId: null as string | null } };
    const first = computeNextStep("AI_CLASSIFICATION", level.payload, state, passes);
    expect(first).toEqual({ code: "reportCase", specimenId: failure() });
    state.report.caseId = failure();
    expect(computeNextStep("AI_CLASSIFICATION", level.payload, state, passes)).toEqual({ code: "reportSafeguard", safeguardId: "person-checks" });
    state.report.safeguardId = "trust-it";
    expect(computeNextStep("AI_CLASSIFICATION", level.payload, state, passes)).toMatchObject({ code: "reportSafeguard" });
    state.report.safeguardId = "keep-testing";
    expect(computeNextStep("AI_CLASSIFICATION", level.payload, state, passes)).toEqual({ code: "ready" });
  });

  it("swaps a case that isn't a failure for one that is", () => {
    const state = { examples, held: PILE, revealed: true, report: { caseId: "b1", safeguardId: "person-checks" } };
    expect(computeNextStep("AI_CLASSIFICATION", level.payload, state, passes)).toEqual({ code: "reportCase", specimenId: failure() });
  });

  it("predict first still comes before the report", () => {
    const state = { examples, held: PILE, revealed: false, report: { caseId: null, safeguardId: null } };
    expect(computeNextStep("AI_CLASSIFICATION", level.payload, state, passes)).toEqual({ code: "predictGuesses" });
  });

  function failure() {
    return reportableCases(asExamples(TAUGHT), held(PILE))[0]!;
  }
});
