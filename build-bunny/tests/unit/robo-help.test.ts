import { describe, expect, it } from "vitest";

import {
  CONCEPT_EXAMPLES,
  exampleForTags,
} from "@/modules/activities/players/shared/concept-examples";
import { programBlocks } from "@/modules/blockly/serialization";
import { gateReachability, gateSolutionRuns } from "@/modules/curriculum/server/gates";
import type { LevelSnapshot } from "@/modules/curriculum/server/publish";

/** Depth-first block types of a workspace JSON (for a toolbox). */
function blockTypes(node: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(node)) node.forEach((n) => blockTypes(n, out));
  else if (node && typeof node === "object") {
    const record = node as Record<string, unknown>;
    if (typeof record.type === "string") out.add(record.type);
    Object.values(record).forEach((v) => blockTypes(v, out));
  }
  return out;
}

describe("programBlocks — which block is which, in the order they run", () => {
  it("numbers statement blocks top to bottom, loop bodies before the block below", () => {
    const json = {
      blocks: {
        blocks: [
          {
            type: "bb_whenStart",
            id: "start",
            next: {
              block: {
                type: "bb_moveForward",
                id: "m1",
                next: {
                  block: {
                    type: "bb_repeat",
                    id: "r1",
                    fields: { TIMES: 2 },
                    inputs: { DO: { block: { type: "bb_turnLeft", id: "t1" } } },
                    next: { block: { type: "bb_moveForward", id: "m2" } },
                  },
                },
              },
            },
          },
          // A loose stack is not part of the program.
          { type: "bb_moveForward", id: "loose" },
        ],
      },
    };
    expect(programBlocks(json)).toEqual([
      { id: "m1", type: "bb_moveForward", index: 1 },
      { id: "r1", type: "bb_repeat", index: 2 },
      { id: "t1", type: "bb_turnLeft", index: 3 },
      { id: "m2", type: "bb_moveForward", index: 4 },
    ]);
  });

  it("ignores sensor value blocks and empty workspaces", () => {
    const json = {
      blocks: {
        blocks: [
          {
            type: "bb_whenStart",
            id: "start",
            next: {
              block: {
                type: "bb_if",
                id: "i1",
                inputs: { CONDITION: { block: { type: "bb_pathAhead", id: "s1" } } },
              },
            },
          },
        ],
      },
    };
    expect(programBlocks(json).map((b) => b.type)).toEqual(["bb_if"]);
    expect(programBlocks({})).toEqual([]);
  });
});

describe("similar examples — a smaller puzzle on the same idea", () => {
  it("picks the most specific concept and never the level's own answer", () => {
    expect(exampleForTags(["loops", "sequencing"])?.tags).toContain("loops");
    expect(exampleForTags(["logic", "reading-code"])?.tags).toContain("logic");
    expect(exampleForTags(["debugging"])?.tags).toContain("debugging");
    expect(exampleForTags(["ai-classification"])).toBeNull();
  });

  it("every example solution actually reaches its goal through the real engine gates", () => {
    for (const example of CONCEPT_EXAMPLES) {
      const toolbox = [...blockTypes(example.solution)]
        .filter((type) => type !== "bb_whenStart")
        .map((type) => ({ type }));
      const snapshot: LevelSnapshot = {
        levelId: `example-${example.tags[0]}`,
        slug: `example-${example.tags[0]}`,
        moduleId: "help",
        moduleSlug: "help",
        worldId: "help",
        worldSlug: "help",
        order: 1,
        activityType: "BLOCK_CODING",
        track: "PROGRAMMING",
        title: { en: "example" },
        story: null,
        objective: { en: "example" },
        mission: null,
        instructions: { en: "example" },
        explanation: { en: "example" },
        teacherNotes: null,
        difficulty: "EASY",
        recommendedGradeMin: null,
        recommendedGradeMax: null,
        estimatedMinutes: 1,
        xpReward: 10,
        maxStars: 3,
        tags: example.tags,
        payload: {
          toolbox,
          variants: [example.variant],
          autoCollect: example.autoCollect,
          nonFatalBumps: false,
          checks: [{ id: "reachedGoal", severity: "core" }],
          starCriteria: { threeStarMaxBlocks: 10 },
          solution: example.solution,
        },
        hints: [],
        arComplete: true,
      };
      const runs = gateSolutionRuns(snapshot);
      expect(runs.ok, `${example.tags[0]}: ${runs.issues.join("; ")}`).toBe(true);
      const reach = gateReachability(snapshot);
      expect(reach.ok, `${example.tags[0]}: ${reach.issues.join("; ")}`).toBe(true);
    }
  });
});
