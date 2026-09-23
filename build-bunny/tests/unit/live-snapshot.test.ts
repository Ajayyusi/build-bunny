import { describe, expect, it } from "vitest";

import { buildLiveSnapshot } from "@/modules/analytics/live";
import type { ClassMatrix } from "@/modules/analytics/server/teacher";

/**
 * The projector view's snapshot: who is where, and the class challenge —
 * a count of children who finished the chosen level, never a ranking.
 */

const cell = (status: string) => ({ status, stars: 0, attempts: 0 });
const matrix = {
  classId: "c1",
  className: "5B",
  grade: 5,
  levels: [
    { id: "l1", slug: "a", title: { en: "First Hop", ar: "القفزة الأولى" }, order: 1, worldSlug: "w", worldName: { en: "W" } },
    { id: "l2", slug: "b", title: { en: "Two Steps" }, order: 2, worldSlug: "w", worldName: { en: "W" } },
  ],
  students: [
    { userId: "s1", displayName: "Ana K.", cells: { l1: cell("COMPLETED"), l2: cell("IN_PROGRESS") }, flags: [] },
    { userId: "s2", displayName: "Ben R.", cells: { l1: cell("COMPLETED"), l2: cell("COMPLETED") }, flags: [] },
    { userId: "s3", displayName: "Cy D.", cells: { l1: cell("UNLOCKED") }, flags: [] },
  ],
  summary: { studentCount: 3, completionPct: 50, avgStars: 1, activeThisWeek: 2 },
} as unknown as ClassMatrix;

describe("buildLiveSnapshot", () => {
  it("places each child on their current level, in the requested language", () => {
    const snap = buildLiveSnapshot(matrix, "ar", null);
    expect(snap.students.map((s) => [s.displayName, s.currentLevelTitle, s.completed])).toEqual([
      ["Ana K.", "Two Steps", false],
      ["Ben R.", null, true],
      ["Cy D.", "القفزة الأولى", false],
    ]);
    expect(snap.levels).toEqual([
      { id: "l1", title: "القفزة الأولى" },
      { id: "l2", title: "Two Steps" },
    ]);
    expect(snap.challenge).toBeNull();
  });

  it("counts who finished the challenge level, and ignores an unknown one", () => {
    expect(buildLiveSnapshot(matrix, "en", "l2").challenge).toEqual({
      levelId: "l2",
      title: "Two Steps",
      finished: 1,
      total: 3,
    });
    expect(buildLiveSnapshot(matrix, "en", "l1").challenge?.finished).toBe(2);
    expect(buildLiveSnapshot(matrix, "en", "not-in-this-class").challenge).toBeNull();
  });
});
