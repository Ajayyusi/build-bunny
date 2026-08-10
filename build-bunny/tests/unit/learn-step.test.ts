import { describe, expect, it } from "vitest";

import {
  blockTypeAt,
  findFadedGap,
  type GapPath,
} from "@/modules/blockly/serialization";
import { conceptCardsPayload, type LevelFixture } from "@/modules/curriculum/schemas";
import { bundle } from "../../content";

/**
 * The Learn step's faded gap (docs/build-bunny/LEARN-STEP-SPEC.md). The gap is
 * addressed structurally rather than by diffing block-type counts, so that
 * "put the missing block back" means the block genuinely landed in the empty
 * connection — not merely that it appeared somewhere on the canvas. These are
 * pure functions over serialized workspace JSON: no Blockly, no database.
 */

type BlockNode = Record<string, unknown>;

/** whenStart → repeat 3 { body? } — the shape every shipped Learn step uses. */
function loopProgram(body?: BlockNode, extraTop?: BlockNode): unknown {
  const loop: BlockNode = {
    type: "bb_repeat",
    id: "loop",
    fields: { TIMES: 3 },
    ...(body ? { inputs: { DO: { block: body } } } : {}),
  };
  return {
    blocks: {
      languageVersion: 0,
      blocks: [
        { type: "bb_whenStart", id: "start", next: { block: loop } },
        ...(extraTop ? [extraTop] : []),
      ],
    },
  };
}

const hop: BlockNode = { type: "bb_moveForward", id: "hop" };
const worked = loopProgram(hop);
const faded = loopProgram();

describe("findFadedGap", () => {
  it("finds the connection the worked example fills and the faded copy leaves empty", () => {
    expect(findFadedGap(worked, faded)).toEqual({
      topIndex: 0,
      steps: [{ kind: "next" }, { kind: "input", name: "DO" }],
    } satisfies GapPath);
  });

  it("returns null when the two programs are identical (no gap to fill)", () => {
    expect(findFadedGap(worked, worked)).toBeNull();
  });

  it("prefers a gap inside a loop's mouth over one after the loop", () => {
    // Worked example with BOTH a body and a trailing block; faded has neither.
    const both = {
      blocks: {
        languageVersion: 0,
        blocks: [
          {
            type: "bb_whenStart",
            id: "start",
            next: {
              block: {
                type: "bb_repeat",
                id: "loop",
                inputs: { DO: { block: hop } },
                next: { block: { type: "bb_turnLeft", id: "turn" } },
              },
            },
          },
        ],
      },
    };
    expect(findFadedGap(both, faded)?.steps.at(-1)).toEqual({
      kind: "input",
      name: "DO",
    });
  });
});

describe("blockTypeAt", () => {
  const gap = findFadedGap(worked, faded) as GapPath;

  it("reads the block a student snapped into the gap", () => {
    expect(blockTypeAt(loopProgram(hop), gap)).toBe("bb_moveForward");
    expect(blockTypeAt(loopProgram({ type: "bb_turnLeft", id: "t" }), gap)).toBe(
      "bb_turnLeft",
    );
  });

  it("reads an untouched faded program as an empty gap", () => {
    expect(blockTypeAt(faded, gap)).toBeNull();
  });

  it("reads a block dropped loose on the canvas as an empty gap", () => {
    // The right block type, but never connected — the gap is still open, so
    // the player re-prompts instead of submitting an answer.
    const loose = loopProgram(undefined, { type: "bb_moveForward", id: "stray", x: 200, y: 200 });
    expect(blockTypeAt(loose, gap)).toBeNull();
  });

  it("reads a block snapped after the loop instead of inside it as an empty gap", () => {
    const afterLoop = {
      blocks: {
        languageVersion: 0,
        blocks: [
          {
            type: "bb_whenStart",
            id: "start",
            next: {
              block: {
                type: "bb_repeat",
                id: "loop",
                fields: { TIMES: 3 },
                next: { block: { type: "bb_moveForward", id: "hop" } },
              },
            },
          },
        ],
      },
    };
    expect(blockTypeAt(afterLoop, gap)).toBeNull();
  });
});

describe("shipped Learn steps are internally coherent", () => {
  const learnLevels = bundle.worlds
    .flatMap((world) => world.modules.flatMap((m) => m.levels.map((level) => ({ world, level }))))
    .filter(({ level }) => level.activityType === "CONCEPT_CARDS");

  it("bunny-meadow ships the repeat Learn step immediately before Repeat After Me", () => {
    const meadow = bundle.worlds.find((w) => w.slug === "bunny-meadow");
    const loopsModule = meadow?.modules.find((m) => m.slug === "carrots-and-loops");
    const ordered = [...(loopsModule?.levels ?? [])].sort((a, b) => a.order - b.order);
    expect(ordered.map((l) => l.slug)).toEqual([
      "carrot-collector",
      "learn-repeat",
      "repeat-after-me",
    ]);
    expect(learnLevels).toHaveLength(1);
  });

  it("the faded copy is the worked example minus exactly the authored missing block", () => {
    for (const { world, level } of learnLevels) {
      const label = `${world.slug}/${level.slug}`;
      const payload = conceptCardsPayload.parse((level as LevelFixture).payload);
      const gap = findFadedGap(payload.workedExample.blocks, payload.faded.blocks);
      expect(gap, `${label}: worked example and faded copy differ by no connection`).not.toBeNull();
      // Filling the gap with the answer must reproduce the worked example —
      // this is what makes the lesson's two beats the same program.
      expect(
        blockTypeAt(payload.workedExample.blocks, gap as GapPath),
        `${label}: the gap does not hold missingBlockType`,
      ).toBe(payload.faded.missingBlockType);
      expect(
        blockTypeAt(payload.faded.blocks, gap as GapPath),
        `${label}: the faded copy has no gap for the student to fill`,
      ).toBeNull();
    }
  });

  it("every block the lesson can use is one the block set actually defines", () => {
    const known = new Set([
      "bb_whenStart",
      "bb_moveForward",
      "bb_turnLeft",
      "bb_turnRight",
      "bb_collect",
      "bb_repeat",
      "bb_repeatUntilGoal",
      "bb_if",
      "bb_ifElse",
      "bb_say",
      "bb_pathAhead",
    ]);
    for (const { world, level } of learnLevels) {
      const payload = conceptCardsPayload.parse((level as LevelFixture).payload);
      for (const entry of payload.faded.toolbox) {
        expect(
          known.has(entry.type),
          `${world.slug}/${level.slug}: unknown toolbox block ${entry.type}`,
        ).toBe(true);
      }
    }
  });
});
