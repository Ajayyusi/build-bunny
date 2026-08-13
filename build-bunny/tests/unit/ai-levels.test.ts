import { describe, expect, it } from "vitest";

import {
  gradeAiClassification,
  trueLabel,
} from "@/modules/activities/server/ai-classification";
import {
  aiClassificationPayload,
  aiClassificationStudentPayload,
  type LevelFixture,
} from "@/modules/curriculum/schemas";
import { stripStudentPayload } from "@/modules/curriculum/server/queries";
import type { LevelSnapshot } from "@/modules/curriculum/server/publish";

import { bundle } from "../../content";

/**
 * The execution gate for every authored AI level.
 *
 * Worlds 1-3 have one of these already: content-fixtures.test.ts runs each
 * hand-authored Blockly solution through the REAL gates, because a level was
 * once shipped whose recorded solution did not actually solve it. The root
 * cause was that no test ever executed the worked example — reading the
 * fixture looked fine.
 *
 * AI levels fail in a nastier way, because there is no single "solution" to
 * eyeball: the level is a trap that must spring, and whether it springs is a
 * property of nearest-neighbour geometry over a dozen hand-written decimals.
 * An author can write a pool that looks balanced and produce a level that
 * either cannot be lost (so it teaches nothing) or cannot be won (so it is
 * just cruel). Neither is visible by reading.
 *
 * So this file brute-forces every sensible training set a student could
 * submit — every subset of the pool, labelled honestly — through the real
 * grader, and asserts the level has the shape its lesson requires.
 */

interface Specimen {
  id: string;
  size: number;
  color: number;
}
interface PoolSpecimen extends Specimen {
  truth: "positive" | "negative";
}

const aiLevels: { world: string; level: LevelFixture }[] = bundle.worlds
  .filter((w) => !w.horizon)
  .flatMap((world) =>
    world.modules
      .flatMap((m) => m.levels)
      .filter((level) => level.activityType === "AI_CLASSIFICATION")
      .map((level) => ({ world: world.slug, level })),
  );

/** Every subset of the pool, each specimen labelled with its own truth. */
function honestTrainingSets(pool: PoolSpecimen[]) {
  const sets: PoolSpecimen[][] = [];
  for (let mask = 1; mask < 1 << pool.length; mask += 1) {
    const set = pool.filter((_, i) => (mask >> i) & 1);
    sets.push(set);
  }
  return sets;
}

/**
 * Runs one training set through the real engine. Mirrors exactly what the
 * player submits — id/size/color/label and nothing else, because the attempts
 * route validates .strict() and a spread specimen 400s.
 */
function grade(level: LevelFixture, examples: PoolSpecimen[]) {
  const snapshot = { payload: level.payload } as unknown as LevelSnapshot;
  return gradeAiClassification(snapshot, {
    examples: examples.map(({ id, size, color, truth }) => ({
      id,
      size,
      color,
      label: truth,
    })),
  });
}

describe.each(aiLevels)("AI level $level.slug ($world)", ({ level }) => {
  const payload = aiClassificationPayload.parse(level.payload);
  const pool = payload.pool as PoolSpecimen[];
  const testSet = payload.testSet as Specimen[];
  const sets = honestTrainingSets(pool);
  // What a student is actually allowed to submit: both buckets taught, and
  // no more examples than the level's cap allows.
  const submittable = sets.filter(
    (s) =>
      s.filter((x) => x.truth === "positive").length >= payload.minPerLabel &&
      s.filter((x) => x.truth === "negative").length >= payload.minPerLabel &&
      (payload.maxExamples === undefined || s.length <= payload.maxExamples),
  );
  const passing = submittable.filter((s) => grade(level, s).verdict === "PASS");
  const failing = submittable.filter((s) => grade(level, s).verdict === "FAIL");

  it("pool specimens agree with the level's own hidden rule, except declared lies", () => {
    // An author writing `truth: "positive"` for a specimen the rule calls
    // negative hands the child two contradictory sources of evidence. They
    // would be right to trust the label they can see, and still lose.
    //
    // One level does this ON PURPOSE — a wrong note is the whole lesson — so
    // the exception must be declared in `mislabelled`. Requiring the
    // declaration is what keeps a genuine typo from hiding behind "it must
    // have been intentional".
    const declared = new Set(payload.mislabelled);
    for (const specimen of pool) {
      if (declared.has(specimen.id)) continue;
      expect(trueLabel(payload.rule, specimen), `${specimen.id}`).toBe(specimen.truth);
    }
  });

  it("every declared lie actually contradicts the rule", () => {
    // A stale declaration is worse than none: it silently switches off the
    // check above for a specimen that no longer needs the exemption.
    for (const id of payload.mislabelled) {
      const specimen = pool.find((p) => p.id === id);
      expect(specimen, `${id} is declared mislabelled but is not in the pool`).toBeDefined();
      expect(trueLabel(payload.rule, specimen!), `${id} is declared a lie but agrees with the rule`)
        .not.toBe(specimen!.truth);
    }
  });

  it("never ships the answer to a level built on a wrong note", () => {
    if (payload.mislabelled.length === 0) return;
    const shipped = JSON.stringify(stripStudentPayload("AI_CLASSIFICATION", level.payload));
    expect(shipped.includes("mislabelled")).toBe(false);
    // Structural, not just the key name: the id itself must not survive in a
    // position that reveals it. It legitimately appears as a pool specimen id.
    expect(aiClassificationStudentPayload.safeParse(
      stripStudentPayload("AI_CLASSIFICATION", level.payload),
    ).success).toBe(true);
  });

  it("holds its test specimens out of the pool", () => {
    const poolIds = new Set(pool.map((p) => p.id));
    for (const probe of testSet) {
      expect(poolIds.has(probe.id), `${probe.id} is in the pool`).toBe(false);
    }
  });

  it("tests both answers, so a one-note model cannot pass", () => {
    // If every held-out specimen were safe, teaching nothing but safe
    // examples would score 100% and the lesson would evaporate.
    const truths = new Set(testSet.map((probe) => trueLabel(payload.rule, probe)));
    expect([...truths].sort()).toEqual(["negative", "positive"]);
  });

  it("has enough of each kind in the pool to reach minPerLabel", () => {
    const positives = pool.filter((p) => p.truth === "positive").length;
    const negatives = pool.length - positives;
    expect(positives, "positives available").toBeGreaterThanOrEqual(payload.minPerLabel);
    expect(negatives, "negatives available").toBeGreaterThanOrEqual(payload.minPerLabel);
  });

  it("has a cap a student can actually satisfy", () => {
    if (payload.maxExamples === undefined) return;
    // minPerLabel * 2 examples is the smallest legal submission; a cap below
    // that makes the level unplayable, and nothing else would notice.
    expect(payload.maxExamples).toBeGreaterThanOrEqual(payload.minPerLabel * 2);
    expect(submittable.length, "no legal submission exists under the cap").toBeGreaterThan(0);
  });

  it("rejects a training set over the cap instead of silently truncating it", () => {
    if (payload.maxExamples === undefined) return;
    const everything = pool;
    if (everything.length <= payload.maxExamples) return;
    const result = grade(level, everything);
    expect(result.verdict).toBe("FAIL");
    expect(result.primaryFeedback).toMatchObject({ code: "tooManyExamples" });
  });

  it("is winnable", () => {
    expect(passing.length, "no honest training set passes this level").toBeGreaterThan(0);
  });

  it("is losable — the trap actually springs", () => {
    // The whole activity is that WHICH examples you pick decides whether the
    // model generalises. If every submittable set passes, the child learns
    // nothing from succeeding, and the level is decoration.
    expect(failing.length, "every honest training set passes — no lesson here").toBeGreaterThan(0);
  });

  it("awards its 3-star budget to a training set that actually exists", () => {
    const budget = payload.starCriteria.threeStarMaxBlocks;
    if (budget == null) return;
    const threeStar = passing.filter(
      (s) => s.length <= budget && grade(level, s).qualityPassed,
    );
    expect(
      threeStar.length,
      `no passing training set of ${budget} examples or fewer exists, so 3 stars is unreachable`,
    ).toBeGreaterThan(0);
  });

  it("cannot be won by teaching the bare minimum from one corner", () => {
    // A level where any minPerLabel-sized pair passes is a level where the
    // student never has to think about coverage. At least one minimal
    // submission must fail, or the trap is theoretical.
    const minimal = submittable.filter((s) => s.length === payload.minPerLabel * 2);
    if (minimal.length === 0) return;
    const minimalFailures = minimal.filter((s) => grade(level, s).verdict === "FAIL");
    expect(
      minimalFailures.length,
      "every smallest-possible training set passes",
    ).toBeGreaterThan(0);
  });

  it("names the specimens it got wrong, so the student knows where to teach", () => {
    const loser = failing[0]!;
    const result = grade(level, loser);
    expect(result.summary.missed).toBeInstanceOf(Array);
    expect((result.summary.missed as string[]).length).toBeGreaterThan(0);
    expect(result.primaryFeedback).toMatchObject({ code: "modelGuessedWrong" });
  });
});

describe("AI level coverage", () => {
  it("has at least one AI level to gate", () => {
    // Guards against this whole suite silently passing on an empty list if
    // the content bundle is refactored.
    expect(aiLevels.length).toBeGreaterThan(0);
  });
});
