import { describe, expect, it } from "vitest";

import {
  blockTypeAt,
  findFadedGap,
  type GapPath,
} from "@/modules/blockly/serialization";
import {
  conceptCardsStudentPayload,
  gradeConceptCards,
} from "@/modules/activities/server/concept-cards";
import { conceptCardsPayload, type LevelFixture } from "@/modules/curriculum/schemas";
import { stripStudentPayload } from "@/modules/curriculum/server/queries";
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

describe("gradeConceptCards", () => {
  // A Learn step is instruction, not assessment: the right block passes, the
  // wrong one invites another go rather than reporting a failure, and the
  // block the student reached for is recorded either way — that choice is the
  // misconception signal the step exists to surface.
  const snapshotFor = (level: LevelFixture) =>
    ({ payload: level.payload }) as unknown as Parameters<typeof gradeConceptCards>[0];

  const learn = bundle.worlds
    .flatMap((w) => w.modules.flatMap((m) => m.levels))
    .find((l) => l.activityType === "CONCEPT_CARDS") as LevelFixture;

  it("passes the authored missing block", () => {
    const answer = conceptCardsPayload.parse(learn.payload).faded.missingBlockType;
    const result = gradeConceptCards(snapshotFor(learn), { blockType: answer });
    expect(result.verdict).toBe("PASS");
    expect(result.qualityPassed).toBe(true);
    expect(result.primaryFeedback).toBeNull();
    expect(result.summary).toMatchObject({ correct: true, blockType: answer });
  });

  it("invites another go at a distractor instead of reporting a failure", () => {
    const payload = conceptCardsPayload.parse(learn.payload);
    const distractor = payload.faded.toolbox
      .map((e) => e.type)
      .find((t) => t !== payload.faded.missingBlockType);
    expect(distractor).toBeTruthy();

    const result = gradeConceptCards(snapshotFor(learn), { blockType: distractor! });
    expect(result.verdict).toBe("FAIL");
    expect(result.qualityPassed).toBe(false);
    // Gentle re-prompt, not a wrong-answer scolding.
    expect(result.primaryFeedback).toEqual({ code: "tryAnotherBlock" });
    // Recorded even when wrong — this is the signal, not noise.
    expect(result.summary).toMatchObject({ correct: false, blockType: distractor });
  });

  it("never awards stars or generated code from a lesson", () => {
    const answer = conceptCardsPayload.parse(learn.payload).faded.missingBlockType;
    const result = gradeConceptCards(snapshotFor(learn), { blockType: answer });
    expect(result.generatedCode).toBe("");
    expect(result.blockCount).toBeNull();
    // maxStars 0 on the level is what zeroes the reward; assert the authored
    // level really carries it, since grading alone would not stop a star.
    expect(learn.maxStars ?? 0).toBe(0);
  });
});

describe("shipped Learn steps are internally coherent", () => {
  const learnLevels = bundle.worlds
    .flatMap((world) => world.modules.flatMap((m) => m.levels.map((level) => ({ world, level }))))
    .filter(({ level }) => level.activityType === "CONCEPT_CARDS");

  // Each Learn step must sit immediately BEFORE the puzzle that first needs
  // its concept — that placement is the entire pedagogical claim. A lesson
  // that drifts after its puzzle still passes every schema check while
  // teaching a concept the student already had to work out alone.
  it.each([
    {
      world: "bunny-meadow",
      module: "carrots-and-loops",
      expected: ["carrot-collector", "learn-repeat", "repeat-after-me"],
    },
    {
      world: "logic-forest",
      module: "forest-decisions",
      expected: [
        "learn-if",
        "choose-the-path",
        "hidden-carrot",
        "forest-challenge",
        "loop-detective",
      ],
    },
    {
      world: "robot-lab",
      module: "power-and-sensors",
      expected: ["power-up", "sensor-check", "learn-if-else", "smart-turns"],
    },
  ])("$world orders its Learn step before the puzzle that needs it", ({ world, module, expected }) => {
    const w = bundle.worlds.find((x) => x.slug === world);
    const mod = w?.modules.find((m) => m.slug === module);
    const ordered = [...(mod?.levels ?? [])].sort((a, b) => a.order - b.order);
    expect(ordered.map((l) => l.slug)).toEqual(expected);
    // Orders must be a clean 1..n run — inserting a lesson without
    // renumbering its siblings would silently duplicate an order.
    expect(ordered.map((l) => l.order)).toEqual(
      Array.from({ length: expected.length }, (_, i) => i + 1),
    );
  });

  it("ships exactly one Learn step per playable world", () => {
    expect(learnLevels).toHaveLength(3);
    const worlds = learnLevels.map(({ world }) => world.slug).sort();
    expect(worlds).toEqual(["bunny-meadow", "logic-forest", "robot-lab"]);
    // Concepts are distinct: a duplicate slug would break spaced review,
    // which selects on conceptSlug.
    const concepts = learnLevels.map(
      ({ level }) => conceptCardsPayload.parse((level as LevelFixture).payload).conceptSlug,
    );
    expect(new Set(concepts).size).toBe(concepts.length);
  });

  // The whole design hinges on this: the answer to a Learn step is the block
  // type removed from the faded copy, and it lives INSIDE `faded` rather than
  // at the payload's top level. stripStudentPayload originally swept only
  // top-level keys, so a regression here ships the answer in the page source
  // and the lesson silently stops teaching anything.
  it("strips the faded gap's answer before the payload reaches a student", () => {
    for (const { world, level } of learnLevels) {
      const authored = conceptCardsPayload.parse((level as LevelFixture).payload);
      expect(authored.faded.missingBlockType).toBeTruthy();

      const shipped = stripStudentPayload("CONCEPT_CARDS", (level as LevelFixture).payload);

      // The answer must not be LABELLED. The block type itself necessarily
      // still ships inside faded.toolbox — the student has to have it to
      // drag — so the property under test is that nothing marks which of the
      // options is correct, not that the string is absent.
      const serialized = JSON.stringify(shipped);
      expect(
        serialized.includes("missingBlockType"),
        `${world.slug}/${level.slug}: answer key survived stripping`,
      ).toBe(false);

      // …and it must not be derivable by elimination. A single-entry toolbox
      // would strip the answer key and still hand it over, since the only
      // draggable block is the right one.
      const shippedToolbox = conceptCardsStudentPayload.parse(shipped).faded.toolbox;
      expect(
        shippedToolbox.length,
        `${world.slug}/${level.slug}: toolbox needs distractors, else the answer is the only option`,
      ).toBeGreaterThan(1);
      expect(shippedToolbox.some((e) => e.type === authored.faded.missingBlockType)).toBe(true);

      // …and the stripped payload must still satisfy the answer-free schema
      // the player re-validates against, so stripping fails open (lesson
      // renders) rather than closed (lesson 500s).
      expect(() =>
        conceptCardsStudentPayload.parse(shipped),
      ).not.toThrow();
    }
  });

  it("does not mutate the caller's payload while stripping", () => {
    // The snapshot object is shared with the grader; stripping in place would
    // erase the answer the grader needs to mark the attempt.
    for (const { level } of learnLevels) {
      const source = (level as LevelFixture).payload as { faded: { missingBlockType?: string } };
      const before = source.faded.missingBlockType;
      stripStudentPayload("CONCEPT_CARDS", source);
      expect(source.faded.missingBlockType).toBe(before);
    }
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
