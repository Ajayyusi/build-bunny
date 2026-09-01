import { describe, expect, it } from "vitest";

import type { LevelFixture, WorldFixture } from "@/modules/curriculum/schemas";

import { STUDENTS } from "../../prisma/seed-data/demo-school";
import { bundle } from "../../content";

/**
 * The demo school's student history is POSITIONAL along the flattened
 * curriculum trail, and nothing enforced that.
 *
 * demo-school.ts says so in a comment — "inserting a level anywhere before
 * the end silently rewrites her history. New levels are appended, never
 * spliced in" — and a comment is exactly as strong as whoever reads it.
 * Robot Lab gained an EASY opener at its front and the whole suite stayed
 * green while the 0 meant for learn-if-else sat on sensor-check instead: a
 * COMPLETED row with no stars on a scored level, which is the one thing the
 * certificate path refuses to issue on.
 *
 * The alignment is checkable, so it is checked. A 0 must land on a Learn
 * step (they have no stars to earn) and a scored level must carry a genuine
 * PASS.
 */

function trail(): LevelFixture[] {
  return bundle.worlds
    .filter((w) => !(w as WorldFixture).horizon)
    .flatMap((w) => (w as WorldFixture).modules.flatMap((m) => m.levels));
}

describe("demo seed history lines up with the curriculum trail", () => {
  const levels = trail();

  it("no student's history runs off the end of the trail", () => {
    for (const student of STUDENTS) {
      expect(
        student.progress.completedStars.length,
        `${student.username} has more history than there are levels`,
      ).toBeLessThanOrEqual(levels.length);
    }
  });

  it("every zero-star entry sits on a Learn step, and every scored one on a puzzle", () => {
    for (const student of STUDENTS) {
      student.progress.completedStars.forEach((stars, index) => {
        const level = levels[index]!;
        const isLesson = level.activityType === "CONCEPT_CARDS";
        if (isLesson) {
          expect(
            stars,
            `${student.username}[${index}] is ${level.slug}, a Learn step with no stars to earn`,
          ).toBe(0);
        } else {
          // The certificate path issues on a genuine PASS, so demo history
          // must not contain a scored level completed with 0 or 1 star.
          expect(
            stars,
            `${student.username}[${index}] is ${level.slug}, a scored level, but has ${stars} stars`,
          ).toBeGreaterThanOrEqual(2);
        }
      });
    }
  });

  it("at least one student reaches the fourth world, or the demo cannot show it", () => {
    // Worlds unlock in order: if nobody clears the first three, AI Island is
    // invisible to anyone opening the demo.
    const firstAiIsland = levels.findIndex((l) => l.slug === "berry-sorter");
    expect(firstAiIsland).toBeGreaterThan(0);
    const deepest = Math.max(...STUDENTS.map((s) => s.progress.completedStars.length));
    expect(deepest, "no demo student has reached AI Island").toBeGreaterThan(firstAiIsland);
  });
});
