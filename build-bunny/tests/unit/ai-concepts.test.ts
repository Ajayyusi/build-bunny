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

describe("concept trends (the school admin's four-week change)", () => {
  it("counts only the evidence that existed at the cutoff", async () => {
    const { conceptInputAsOf } = await import("@/modules/analytics/ai-concepts");
    const old = new Date("2026-09-01T00:00:00Z");
    const recent = new Date("2026-09-30T00:00:00Z");
    const cutoff = new Date("2026-09-15T00:00:00Z");
    const input = {
      levelIdBySlug: new Map(),
      students: [{ id: "a", grade: 5 }],
      completed: [
        { studentId: "a", levelId: "L1", stars: 3, at: old },
        { studentId: "a", levelId: "L2", stars: 3, at: recent },
        { studentId: "a", levelId: "L3", stars: 2, at: null },
      ],
      checks: [
        { studentId: "a", levelId: "L1", firstChoice: "b", firstCorrect: true, correct: true, at: old },
        { studentId: "a", levelId: "L2", firstChoice: "a", firstCorrect: false, correct: true, at: recent },
      ],
      checkConceptOf: new Map(),
      attemptsByLevel: new Map(),
      retriesByLevel: new Map(),
      soundSentences: [{ studentId: "a", levelId: "L2", at: recent }],
      observed: [{ studentId: "a", concept: "bias", at: recent }],
    };
    const then = conceptInputAsOf(input, cutoff);
    expect(then.completed.map((r) => r.levelId)).toEqual(["L1", "L3"]);
    expect(then.checks.map((r) => r.correct)).toEqual([true, false]);
    expect(then.soundSentences).toEqual([]);
    expect(then.observed).toEqual([]);
  });

  it("the change reads with its sign, in both languages", async () => {
    const { createTranslator } = await import("next-intl");
    const en = (await import("../../messages/en.json")).default;
    const ar = (await import("../../messages/ar.json")).default;
    const tEn = createTranslator({ locale: "en", messages: en, namespace: "staff.school.analytics.ai" });
    expect(tEn("trend", { change: 2 })).toBe("+2 in 4 weeks");
    expect(tEn("trend", { change: 0 })).toBe("no change in 4 weeks");
    expect(tEn("trend", { change: -1 })).toBe("-1 in 4 weeks");
    const tAr = createTranslator({ locale: "ar", messages: ar, namespace: "staff.school.analytics.ai" });
    expect(tAr("trend", { change: 2 })).toMatch(/خلال 4 أسابيع/);
  });
});
