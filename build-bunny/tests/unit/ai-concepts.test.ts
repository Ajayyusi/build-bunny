import { describe, expect, it } from "vitest";

import { AI_CONCEPT_LEVELS, masteryOf, summariseAiConcepts } from "@/modules/analytics/ai-concepts";

import { bundle } from "../../content";

describe("AI concept mastery", () => {
  it("secure needs two finished levels, two stars on average, and an explanation where asked", () => {
    const levels = ["l1", "l2", "l3"];
    const done = (entries: [string, number][]) => new Map(entries);
    expect(masteryOf(levels, done([]), new Set(), [])).toBe("notStarted");
    expect(masteryOf(levels, done([["l1", 3]]), new Set(), [])).toBe("working");
    expect(masteryOf(levels, done([["l1", 3], ["l2", 2]]), new Set(), [])).toBe("secure");
    // Low stars: still working on it.
    expect(masteryOf(levels, done([["l1", 1], ["l2", 2]]), new Set(), [])).toBe("working");
    // A quick check exists: it must have been explained.
    expect(masteryOf(levels, done([["l1", 3], ["l2", 3]]), new Set(), ["l1"])).toBe("working");
    expect(masteryOf(levels, done([["l1", 3], ["l2", 3]]), new Set(["l1"]), ["l1"])).toBe("secure");
    // A concept with one level in the programme needs just that one.
    expect(masteryOf(["only"], done([["only", 2]]), new Set(), [])).toBe("secure");
  });

  it("summarises a class: counts, grade bands, checks, retries and the most common wrong idea", () => {
    const levelIdBySlug = new Map([
      ["train-a-sorter", "L-train"],
      ["berry-sorter", "L-berry"],
      ["fortune-teller", "L-fortune"],
    ]);
    const [quality, , , uncertainty] = summariseAiConcepts({
      levelIdBySlug,
      students: [
        { id: "a", grade: 3 },
        { id: "b", grade: 4 },
        { id: "c", grade: 6 },
      ],
      completed: [
        { studentId: "a", levelId: "L-train", stars: 3 },
        { studentId: "a", levelId: "L-berry", stars: 2 },
        { studentId: "b", levelId: "L-train", stars: 2 },
        { studentId: "c", levelId: "L-fortune", stars: 3 },
      ],
      checks: [
        { studentId: "a", levelId: "L-train", firstChoice: "a", firstCorrect: false, correct: true },
        { studentId: "b", levelId: "L-train", firstChoice: "a", firstCorrect: false, correct: false },
        { studentId: "c", levelId: "L-train", firstChoice: "c", firstCorrect: false, correct: false },
      ],
      checkConceptOf: new Map([["L-train", "examples" as const]]),
      attemptsByLevel: new Map([["L-train", 5], ["L-berry", 2]]),
      retriesByLevel: new Map([["L-train", 3]]),
    });
    expect(quality).toMatchObject({
      concept: "exampleQuality",
      levels: 2,
      secure: 1,
      working: 1,
      notStarted: 1,
      attempts: 7,
      retries: 3,
      misconception: { checkConcept: "examples", choice: "a", count: 2 },
      byBand: { younger: { secure: 1, students: 2 }, older: { secure: 0, students: 1 } },
    });
    expect(uncertainty).toMatchObject({ concept: "uncertainty", levels: 1, secure: 1, notStarted: 2, misconception: null });
  });

  it("every concept's levels are real levels", () => {
    const slugs = new Set(bundle.worlds.flatMap((w) => w.modules.flatMap((m) => m.levels.map((l) => l.slug))));
    for (const [concept, levels] of Object.entries(AI_CONCEPT_LEVELS)) {
      expect(levels.length, concept).toBeGreaterThanOrEqual(3);
      for (const slug of levels) expect(slugs.has(slug), `${concept}: ${slug}`).toBe(true);
    }
  });
});
