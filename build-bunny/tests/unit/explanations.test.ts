import { describe, expect, it } from "vitest";

import { masteryOf, summariseAiConcepts } from "@/modules/analytics/ai-concepts";
import { CONCEPT_CHECKS, lessonKindOf } from "@/modules/explore/catalog";
import {
  EXPLAIN_CONCEPT_FOR_LEVEL,
  EXPLAIN_CONCEPTS,
  EXPLAIN_SLOTS,
  isValidSentence,
  partId,
  phrasesFor,
} from "@/modules/explore/explanations";
import { SOUND_PARTS, soundCount } from "@/modules/explore/server/explanations-key";

import en from "../../messages/en.json";
import ar from "../../messages/ar.json";
import { bundle } from "../../content";

type Phrases = Record<string, Record<string, string>>;

describe("Say it your way", () => {
  // Handoff launch criterion: "every AI lesson produces an explanation in
  // the learner's own words".
  it("is offered on every AI lesson, about an idea that has phrases", () => {
    const aiLessons = bundle.worlds.flatMap((w) =>
      w.modules.flatMap((m) => m.levels.filter((l) => lessonKindOf({ slug: l.slug, activityType: l.activityType }) === "ai")),
    );
    expect(aiLessons.length).toBeGreaterThanOrEqual(30);
    for (const level of aiLessons) {
      expect(EXPLAIN_CONCEPT_FOR_LEVEL[level.slug], level.slug).toBeDefined();
      expect(EXPLAIN_CONCEPTS).toContain(EXPLAIN_CONCEPT_FOR_LEVEL[level.slug]);
    }
    // Nothing mapped that isn't a real AI lesson.
    const slugs = new Set(aiLessons.map((l) => l.slug));
    for (const slug of Object.keys(EXPLAIN_CONCEPT_FOR_LEVEL)) expect(slugs.has(slug), slug).toBe(true);
  });

  it("asks about the same idea as the level's quick check", () => {
    for (const [slug, check] of Object.entries(CONCEPT_CHECKS)) expect(EXPLAIN_CONCEPT_FOR_LEVEL[slug], slug).toBe(check.concept);
  });

  it("has three phrases per row, in both languages, and one sound phrase per row", () => {
    for (const lang of [en, ar]) {
      const phrases = lang.student.play.explain as unknown as Phrases;
      for (const concept of EXPLAIN_CONCEPTS) {
        for (const slot of EXPLAIN_SLOTS) {
          for (const id of phrasesFor(slot)) expect(phrases[concept]?.[id], `${concept}.${id}`).toBeTruthy();
        }
      }
    }
    for (const concept of EXPLAIN_CONCEPTS) {
      for (const slot of EXPLAIN_SLOTS) {
        const sound = phrasesFor(slot).filter((id) => SOUND_PARTS.has(partId(concept, id)));
        expect(sound, `${concept}.${slot}`).toHaveLength(1);
      }
    }
  });

  it("accepts one phrase per row, in order, for the level's concept only", () => {
    expect(isValidSentence("examples", ["examples.what2", "examples.why1", "examples.next3"])).toBe(true);
    expect(isValidSentence("examples", ["examples.why1", "examples.what2", "examples.next3"])).toBe(false);
    expect(isValidSentence("examples", ["rules.what1", "examples.why1", "examples.next3"])).toBe(false);
    expect(isValidSentence("examples", ["examples.what2", "examples.why1"])).toBe(false);
    expect(soundCount(["examples.what2", "examples.why1", "examples.next3"])).toBe(3);
    expect(soundCount(["examples.what1", "examples.why1", "examples.next1"])).toBe(1);
  });
});

describe("explaining counts towards mastery", () => {
  const done = new Map([
    ["L1", 3],
    ["L2", 2],
  ]);
  it("a quick check, a fully sound sentence or a teacher's tick", () => {
    expect(masteryOf(["L1", "L2"], done, new Set(), ["L1"])).toBe("working");
    expect(masteryOf(["L1", "L2"], done, new Set(["L1"]), ["L1"])).toBe("secure");
    const base = {
      levelIdBySlug: new Map([
        ["train-a-sorter", "L1"],
        ["berry-sorter", "L2"],
      ]),
      students: [{ id: "a", grade: 5 }],
      completed: [
        { studentId: "a", levelId: "L1", stars: 3 },
        { studentId: "a", levelId: "L2", stars: 2 },
      ],
      checks: [],
      checkConceptOf: new Map([["L1", "examples" as const]]),
      attemptsByLevel: new Map(),
      retriesByLevel: new Map(),
    };
    expect(summariseAiConcepts(base)[0]!.secure).toBe(0);
    expect(summariseAiConcepts({ ...base, soundSentences: [{ studentId: "a", levelId: "L2" }] })[0]!.secure).toBe(1);
    expect(summariseAiConcepts({ ...base, observed: [{ studentId: "a", concept: "exampleQuality" }] })[0]!.secure).toBe(1);
    // A tick for another concept doesn't count here.
    expect(summariseAiConcepts({ ...base, observed: [{ studentId: "a", concept: "bias" }] })[0]!.secure).toBe(0);
  });
});
