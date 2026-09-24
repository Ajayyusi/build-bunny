import { describe, expect, it } from "vitest";

import { gradeAiClassification } from "@/modules/activities/server/ai-classification";
import { gradePatternRecognition } from "@/modules/activities/server/pattern-recognition";
import { tightness } from "@/modules/ai/grouping";
import {
  aiClassificationPayload,
  patternRecognitionPayload,
  type LevelFixture,
} from "@/modules/curriculum/schemas";
import type { LevelSnapshot } from "@/modules/curriculum/server/publish";
import { bundle } from "../../content";

/**
 * The curriculum-expansion AI levels make claims their copy depends on —
 * "teaching only the typical berries fails the rare one", "the reference
 * flags pass" — so those claims are proven here against the real graders,
 * exactly as the earlier AI levels' numbers are.
 */

function levelBySlug(slug: string): LevelFixture {
  for (const world of bundle.worlds) {
    for (const mod of world.modules) {
      const level = mod.levels.find((l) => l.slug === slug);
      if (level) return level;
    }
  }
  throw new Error(`fixture level ${slug} not found`);
}

const snapshotOf = (level: LevelFixture) =>
  ({ payload: level.payload, activityType: level.activityType }) as unknown as LevelSnapshot;

describe("bias-detective (AI_CLASSIFICATION)", () => {
  const level = levelBySlug("bias-detective");
  const payload = aiClassificationPayload.parse(level.payload);
  const teach = (...ids: string[]) => ({
    examples: ids.map((id) => {
      const specimen = payload.pool.find((p) => p.id === id)!;
      return { id, size: specimen.size, color: specimen.color, label: specimen.truth };
    }),
  });

  it("every pool berry agrees with the colour rule — the skew is in the mix, not in lies", () => {
    const rule = payload.rule;
    expect(rule.kind).toBe("threshold");
    if (rule.kind !== "threshold") return;
    for (const berry of payload.pool) {
      expect(berry.truth).toBe(berry.color < rule.threshold ? "positive" : "negative");
    }
    expect(payload.mislabelled).toEqual([]);
  });

  it("teaching only the typical berries learns the size shortcut and misreads the big pale one", () => {
    const result = gradeAiClassification(snapshotOf(level), teach("p1", "p2", "n1", "n2"));
    expect(result.verdict).toBe("FAIL");
  });

  it("including the two rare berries passes with three stars", () => {
    const result = gradeAiClassification(snapshotOf(level), teach("p1", "p4", "n1", "n4"));
    expect(result.verdict).toBe("PASS");
    expect(result.qualityPassed).toBe(true);
  });
});

describe("three-waterholes (PATTERN_RECOGNITION)", () => {
  const level = levelBySlug("three-waterholes");
  const payload = patternRecognitionPayload.parse(level.payload);
  const P = (size: number, color: number) => ({ size, color });

  it("the reference placement is comfortably above the pass bar", () => {
    const score = tightness(payload.specimens, payload.groundTruth.referencePlacement);
    expect(score).toBeGreaterThan(payload.objective.minTightness + 0.08);
    const result = gradePatternRecognition(snapshotOf(level), {
      markers: payload.groundTruth.referencePlacement,
      excluded: [],
    });
    expect(result.verdict).toBe("PASS");
  });

  it("a flag stranded between two crowds fails", () => {
    const stranded = [P(0.19, 0.22), P(0.7, 0.55), P(0.35, 0.5)];
    expect(tightness(payload.specimens, stranded)).toBeLessThan(payload.objective.minTightness);
    const result = gradePatternRecognition(snapshotOf(level), { markers: stranded, excluded: [] });
    expect(result.verdict).toBe("FAIL");
  });
});
