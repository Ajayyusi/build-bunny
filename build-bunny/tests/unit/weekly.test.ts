import { describe, expect, it } from "vitest";

import { forStudents, secureByConcept, summariseAiConcepts } from "@/modules/analytics/ai-concepts";
import { mondayUtc, weekStarts, weeklySeries } from "@/modules/analytics/weekly";

describe("weekly AI activity", () => {
  it("weeks start on Monday (UTC), oldest first, ending this week", () => {
    const wed = new Date("2026-09-30T10:00:00Z");
    expect(mondayUtc(wed).toISOString().slice(0, 10)).toBe("2026-09-28");
    expect(mondayUtc(new Date("2026-09-27T23:00:00Z")).toISOString().slice(0, 10)).toBe("2026-09-21");
    expect(weekStarts(wed, 3)).toEqual(["2026-09-14", "2026-09-21", "2026-09-28"]);
  });

  it("zero-fills quiet weeks and sorts events into the four counts", () => {
    const series = weeklySeries(
      [
        { week: new Date("2026-09-28T00:00:00Z"), type: "LEVEL_SESSION_STARTED", n: 4 },
        { week: new Date("2026-09-28T00:00:00Z"), type: "LEVEL_STARTED", n: 1 },
        { week: new Date("2026-09-28T00:00:00Z"), type: "AI_TEST", n: 3 },
        { week: new Date("2026-09-28T00:00:00Z"), type: "RUN_EXECUTED", n: 2 },
        { week: new Date("2026-09-14T00:00:00Z"), type: "AI_RETRY", n: 1 },
        { week: new Date("2026-09-14T00:00:00Z"), type: "LEVEL_COMPLETED", n: 2 },
        // Older than the window: ignored.
        { week: new Date("2026-08-03T00:00:00Z"), type: "AI_TEST", n: 9 },
      ],
      new Date("2026-09-30T10:00:00Z"),
      3,
    );
    expect(series).toEqual([
      { weekStart: "2026-09-14", starts: 0, tests: 0, retries: 1, completions: 2 },
      { weekStart: "2026-09-21", starts: 0, tests: 0, retries: 0, completions: 0 },
      { weekStart: "2026-09-28", starts: 5, tests: 5, retries: 0, completions: 0 },
    ]);
  });
});

describe("concept mastery by class", () => {
  it("narrows one school load to a class and reports secure of students", () => {
    const input = {
      levelIdBySlug: new Map([["fortune-teller", "F"]]),
      students: [
        { id: "a", grade: 5 },
        { id: "b", grade: 5 },
        { id: "c", grade: 5 },
      ],
      completed: [
        { studentId: "a", levelId: "F", stars: 3 },
        { studentId: "c", levelId: "F", stars: 3 },
      ],
      checks: [],
      checkConceptOf: new Map(),
      attemptsByLevel: new Map(),
      retriesByLevel: new Map(),
    };
    const classAB = secureByConcept(summariseAiConcepts(forStudents(input, new Set(["a", "b"]))));
    expect(classAB.uncertainty).toEqual({ secure: 1, students: 2, levels: 1 });
    expect(classAB.bias).toEqual({ secure: 0, students: 2, levels: 0 });
  });
});
