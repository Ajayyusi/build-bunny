import { describe, expect, it } from "vitest";

import { gradeAiClassification, trueLabel } from "@/modules/activities/server/ai-classification";
import { fittingRules, ruleMisses } from "@/modules/ai/rule-round";
import { aiClassificationPayload } from "@/modules/curriculum/schemas";
import type { LevelSnapshot } from "@/modules/curriculum/server/publish";

import { bundle } from "../../content";

/**
 * Rules versus learning on the SAME sorting challenge as the first session
 * (handoff: "colour rule vs trained sorter on a new shape"; "student
 * compares a human-written rule with a classifier trained on labelled
 * examples").
 */

const levels = bundle.worlds.flatMap((w) => w.modules.flatMap((m) => m.levels));
const find = (slug: string) => levels.find((l) => l.slug === slug)!;
const bridge = find("rule-or-examples");
const sorter = aiClassificationPayload.parse(find("train-a-sorter").payload);
const p = aiClassificationPayload.parse(bridge.payload);

describe("Rule or Examples? is Train a Sorter's challenge", () => {
  it("sorts the same things the same way: circles and squares, by shape", () => {
    expect(p.theme?.glyph).toBe("shape");
    expect(p.labels).toEqual(sorter.labels);
    expect(p.rule).toEqual(sorter.rule);
  });

  it("only the colour rule fits yesterday, and it gets the orange circle and the red square wrong today", () => {
    const round = p.ruleRound!;
    const fits = fittingRules(round.rules, round.yesterday);
    expect(fits.map((r) => r.id)).toEqual(["red"]);
    expect(fits[0]!.feature).toBe("color");
    const wrong = ruleMisses(fits[0]!, round.today).map((id) => round.today.find((s) => s.id === id)!);
    expect(wrong).toHaveLength(2);
    // One circle that isn't red, one square that is.
    expect(wrong.map((s) => trueLabel(p.rule, s)).sort()).toEqual(["negative", "positive"]);
  });

  it("the learner trained on examples copes, once the examples include the new kinds", () => {
    const snapshot = { payload: bridge.payload } as unknown as LevelSnapshot;
    const teach = (ids: string[]) =>
      gradeAiClassification(snapshot, {
        examples: ids.map((id) => {
          const s = p.pool.find((x) => x.id === id)!;
          return { id, size: s.size, color: s.color, label: s.truth };
        }),
      });
    // Colour lined up with shape, as yesterday: the learner copies colour too.
    expect(teach(["s1", "s2", "s3", "s4"]).verdict).toBe("FAIL");
    // Add an orange circle and a red square: it sorts by shape.
    expect(teach(["s1", "s5", "s3", "s6"]).verdict).toBe("PASS");
  });
});
