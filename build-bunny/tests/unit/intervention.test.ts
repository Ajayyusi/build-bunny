import { describe, expect, it } from "vitest";

import { suggestInterventions } from "@/modules/analytics/server/intervention";
import type { FlagEvidence } from "@/modules/analytics/server/teacher";

/**
 * The suggestion engine is deterministic and pure, so it is tested the same
 * way the grading engines are: facts in, structured advice out, no database.
 * The rules that matter here are the ones a teacher would notice if they
 * broke — that a suggestion names the level the flag actually fired on, that
 * the most actionable item sorts first, and that a healthy student produces
 * silence rather than filler.
 */

const NO_EVIDENCE: FlagEvidence = {
  stuck: null,
  overtime: null,
  hintHeavyLevels: 0,
  quietSchoolDays: null,
};

const titles = new Map([
  ["lvl-loops", { en: "Loop Garden", ar: "حديقة التكرار" }],
  ["lvl-slow", { en: "Sensor Check", ar: "فحص المستشعر" }],
]);

describe("suggestInterventions", () => {
  it("says nothing about a student with no flags", () => {
    expect(suggestInterventions({ flags: [], evidence: NO_EVIDENCE, levelTitles: titles })).toEqual(
      [],
    );
  });

  it("names the level and attempt count a STUCK flag fired on", () => {
    const [suggestion] = suggestInterventions({
      flags: ["STUCK"],
      evidence: { ...NO_EVIDENCE, stuck: { levelId: "lvl-loops", attempts: 5 } },
      levelTitles: titles,
    });
    expect(suggestion).toEqual({
      kind: "REVIEW_CONCEPT",
      levelId: "lvl-loops",
      levelTitle: { en: "Loop Garden", ar: "حديقة التكرار" },
      facts: { attempts: 5 },
    });
  });

  it("orders the most actionable suggestion first", () => {
    const kinds = suggestInterventions({
      flags: ["HEAVY_HINTS", "INACTIVE", "STUCK"],
      evidence: {
        stuck: { levelId: "lvl-loops", attempts: 4 },
        overtime: null,
        hintHeavyLevels: 3,
        quietSchoolDays: 6,
      },
      levelTitles: titles,
    }).map((s) => s.kind);
    // Review the blocking concept before chasing hint habits.
    expect(kinds).toEqual(["REVIEW_CONCEPT", "CHECK_IN", "HINT_RELIANCE"]);
  });

  it("suppresses PACING when the student is already STUCK on the same problem", () => {
    const kinds = suggestInterventions({
      flags: ["STUCK", "OVERTIME"],
      evidence: {
        stuck: { levelId: "lvl-loops", attempts: 4 },
        overtime: { levelId: "lvl-loops", minutes: 40, estimatedMinutes: 10 },
        hintHeavyLevels: 0,
        quietSchoolDays: null,
      },
      levelTitles: titles,
    }).map((s) => s.kind);
    // "Slow" is not a second problem when the cause is already named.
    expect(kinds).toEqual(["REVIEW_CONCEPT"]);
  });

  it("reports PACING on its own with both the real and expected minutes", () => {
    const [suggestion] = suggestInterventions({
      flags: ["OVERTIME"],
      evidence: {
        ...NO_EVIDENCE,
        overtime: { levelId: "lvl-slow", minutes: 33, estimatedMinutes: 10 },
      },
      levelTitles: titles,
    });
    expect(suggestion?.kind).toBe("PACING");
    expect(suggestion?.facts).toEqual({ minutes: 33, estimatedMinutes: 10 });
    expect(suggestion?.levelTitle).toEqual({ en: "Sensor Check", ar: "فحص المستشعر" });
  });

  it("omits the day count rather than inventing one when the student was never active", () => {
    const [suggestion] = suggestInterventions({
      flags: ["INACTIVE"],
      evidence: { ...NO_EVIDENCE, quietSchoolDays: null },
      levelTitles: titles,
    });
    expect(suggestion?.kind).toBe("CHECK_IN");
    expect(suggestion?.facts).toEqual({});
  });

  it("survives a level title the curriculum no longer has", () => {
    const [suggestion] = suggestInterventions({
      flags: ["STUCK"],
      evidence: { ...NO_EVIDENCE, stuck: { levelId: "lvl-deleted", attempts: 3 } },
      levelTitles: titles,
    });
    // The advice still stands even when the title cannot be resolved.
    expect(suggestion?.kind).toBe("REVIEW_CONCEPT");
    expect(suggestion?.levelTitle).toBeNull();
  });

  it("tells a teacher to help a NOT_STARTED student begin", () => {
    const kinds = suggestInterventions({
      flags: ["NOT_STARTED"],
      evidence: NO_EVIDENCE,
      levelTitles: titles,
    }).map((s) => s.kind);
    expect(kinds).toEqual(["GET_STARTED"]);
  });
});
