import { describe, expect, it, vi } from "vitest";

import { checkSchema, type LevelFixture } from "@/modules/curriculum/schemas";
import type { LevelSnapshot } from "@/modules/curriculum/server/publish";
import { bundle } from "../../content";
import {
  addCounter,
  doTrick,
  hat,
  left,
  move,
  repeat,
  right,
  sayCounter,
  setCounter,
  trick,
  withTops,
} from "../../content/worlds/kit";

vi.mock("server-only", () => ({}));

const { gradeWorkspace } = await import("@/modules/grading/server/grade");
const { gradeMaze } = await import("@/modules/grading/server/maze");

/**
 * Shortcuts found in the 2027 quality review, replayed against the real
 * graders. Each must now fail (or stay PARTIAL) — and the authored solutions
 * still pass, which the playthrough integration test proves for every level.
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
const snapshotOf = (slug: string) => {
  const level = levelBySlug(slug);
  return { payload: level.payload, activityType: level.activityType } as unknown as LevelSnapshot;
};

describe("counter levels need counting", () => {
  it("count-the-hops: typing the answer into a Set block is not possible any more", () => {
    const outcome = gradeWorkspace(snapshotOf("count-the-hops"), hat(repeat(4, move()), setCounter(4), sayCounter()));
    expect(outcome.verdict).not.toBe("PASS");
  });

  it("countdown: hopping and saying the untouched counter no longer passes", () => {
    const outcome = gradeWorkspace(snapshotOf("countdown"), hat(repeat(3, move()), sayCounter()));
    expect(outcome.verdict).toBe("FAIL");
    expect(outcome.primaryFeedback?.code).toBe("missingBlock");
  });

  it("countdown: the counting solution still passes", () => {
    const outcome = gradeWorkspace(
      snapshotOf("countdown"),
      hat(setCounter(3), repeat(3, move(), addCounter(-1)), sayCounter()),
    );
    expect(outcome.verdict).toBe("PASS");
  });
});

describe("trick levels need a real trick", () => {
  it("trick-or-loop: calling an empty trick is PARTIAL, not a pass", () => {
    const outcome = gradeWorkspace(
      snapshotOf("trick-or-loop"),
      withTops([trick()], repeat(3, move(), right(), move(), left()), doTrick()),
    );
    expect(outcome.verdict).toBe("PARTIAL");
  });
});

describe("build-your-own mazes", () => {
  it("tiny-maze: a burrow right next to the bunny is refused", () => {
    const grade = gradeMaze(snapshotOf("tiny-maze"), {
      design: { rows: [".G.#", "....", "...."], start: { x: 0, y: 0, dir: "E" } },
      workspaceJson: hat(move()),
    } as never);
    expect(grade.issues).toContainEqual(expect.objectContaining({ code: "goalTooClose" }));
    expect(grade.outcome).toBeNull();
  });

  it("tiny-maze: the burrow on the bunny's own tile is refused", () => {
    const grade = gradeMaze(snapshotOf("tiny-maze"), {
      design: { rows: ["G..#", "....", "...."], start: { x: 0, y: 0, dir: "E" } },
      workspaceJson: hat(),
    } as never);
    expect(grade.outcome).toBeNull();
  });
});

describe("checks with broken params are refused when authored", () => {
  it("variableEquals and usedBlock need their params", () => {
    expect(checkSchema.safeParse({ id: "variableEquals", severity: "core", params: { variable: "counter", value: 4 } }).success).toBe(false);
    expect(checkSchema.safeParse({ id: "variableEquals", severity: "core", params: { name: "counter", value: "4" } }).success).toBe(false);
    expect(checkSchema.safeParse({ id: "usedBlock", severity: "core", params: { type: "bb_repeat" } }).success).toBe(false);
    expect(checkSchema.safeParse({ id: "variableEquals", severity: "core", params: { name: "counter", value: 4 } }).success).toBe(true);
    expect(checkSchema.safeParse({ id: "usedTrick", severity: "secondary" }).success).toBe(true);
  });
});
