import { describe, expect, it } from "vitest";

import { gradeMarkItems, markableItems, stripMarkItemsConfig } from "@/modules/ai/lab/mark-items/grade";
import { aiSimAnswerSchema } from "@/modules/activities/server/ai-sim";
import { aiSimPayload, markItemsConfig } from "@/modules/curriculum/schemas";

import { bundle } from "../../content";

const levels = bundle.worlds.flatMap((w) => w.modules.flatMap((m) => m.levels));
const widgetOf = (slug: string) => {
  const w = aiSimPayload.parse(levels.find((l) => l.slug === slug)!.payload).widget;
  if (w.widgetId !== "mark-items") throw new Error("not mark-items");
  return markItemsConfig.parse(w);
};
const allRight = (slug: string) =>
  Object.fromEntries(markableItems(widgetOf(slug)).map((item) => [item.id, item.answer!]));

describe("mark the items", () => {
  for (const slug of ["two-answers", "need-to-know", "say-it-clearly"]) {
    it(`${slug}: every right mark passes; one wrong mark fails and says how many are right`, () => {
      const config = widgetOf(slug);
      expect(gradeMarkItems(config, { marks: allRight(slug) })).toMatchObject({ verdict: "PASS", qualityPassed: true });
      const items = markableItems(config);
      const first = items[0]!;
      const other = first.options
        ? first.options.find((o) => o.id !== first.answer)!.id
        : config.marks!.find((m) => m.id !== first.answer)!.id;
      const graded = gradeMarkItems(config, { marks: { ...allRight(slug), [first.id]: other } });
      expect(graded).toMatchObject({
        verdict: "FAIL",
        primaryFeedback: { code: "marksWrong", data: { correct: items.length - 1, total: items.length } },
      });
    });

    it(`${slug}: the child's copy has no answers`, () => {
      const student = JSON.stringify(stripMarkItemsConfig(widgetOf(slug)));
      expect(student).not.toContain('"answer"');
    });
  }

  it("untouched tokens count as the default mark (keep)", () => {
    const config = widgetOf("need-to-know");
    const strikes = Object.fromEntries(markableItems(config).filter((i) => i.answer === "strike").map((i) => [i.id, "strike"]));
    expect(gradeMarkItems(config, { marks: strikes }).verdict).toBe("PASS");
    // Striking a needed detail fails.
    expect(gradeMarkItems(config, { marks: { ...strikes, t12: "strike" } }).verdict).toBe("FAIL");
  });

  it("the attempts route accepts the answer shape as is", () => {
    const parsed = aiSimAnswerSchema.safeParse({ marks: { a1: "says" } });
    expect(parsed.success && "marks" in parsed.data).toBe(true);
  });

  it("the question-first levels ask before the items; privacy and generative AI are tagged for their standards", () => {
    expect(widgetOf("two-answers").predict).toBeDefined();
    expect(widgetOf("say-it-clearly").predict).toBeDefined();
    expect(levels.find((l) => l.slug === "say-it-clearly")?.recommendedGradeMin).toBe(5);
    expect(levels.find((l) => l.slug === "two-answers")?.tags).toContain("generative-ai");
  });
});
