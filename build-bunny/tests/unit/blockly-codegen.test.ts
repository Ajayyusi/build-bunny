import { describe, expect, it } from "vitest";
import { Blockly } from "@/modules/blockly/blockly-core";
import {
  BUNNY_BLOCK_TYPES,
  registerBunnyBlocks,
} from "@/modules/blockly/blocks";
import {
  buildDisplayGenerator,
  buildRunnableGenerator,
} from "@/modules/blockly/codegen";
import {
  computeBlockStats,
  jsonToWorkspace,
  validateWhitelist,
  type BlockRef,
} from "@/modules/blockly/serialization";
import {
  WhitelistViolationError,
  generateRunnableCode,
} from "@/modules/blockly/server/codegen";
import { bundle } from "../../content";
import type { LevelFixture } from "@/modules/curriculum/schemas";

/**
 * Headless Blockly 13 in Node is the riskiest M3 seam: these tests prove
 * block registration, serialization round-trips and both generators work
 * without a DOM, and that the hand-authored fixture solutions are loadable
 * programs producing the exact ES5 the interpreter will run.
 */

registerBunnyBlocks("en");

// ── Helpers ──────────────────────────────────────────────────────────────

interface BlockCodingPayloadShape {
  toolbox: BlockRef[];
  solution?: unknown;
  startWorkspace?: unknown;
  brokenWorkspace?: unknown;
}

function levelBySlug(slug: string): LevelFixture {
  for (const world of bundle.worlds) {
    for (const worldModule of world.modules) {
      const level = worldModule.levels.find((l) => l.slug === slug);
      if (level) return level;
    }
  }
  throw new Error(`fixture level ${slug} not found`);
}

function payloadOf(level: LevelFixture): BlockCodingPayloadShape {
  return level.payload as BlockCodingPayloadShape;
}

function generateBoth(workspaceJson: unknown): {
  display: string;
  runnable: string;
} {
  const workspace = jsonToWorkspace(workspaceJson);
  try {
    return {
      display: buildDisplayGenerator().workspaceToCode(workspace),
      runnable: buildRunnableGenerator().workspaceToCode(workspace),
    };
  } finally {
    workspace.dispose();
  }
}

/** whenStart → repeat 4 { moveForward → ifElse(pathAhead){left}{right} } */
const NESTED_PROGRAM = {
  blocks: {
    languageVersion: 0,
    blocks: [
      {
        type: "bb_whenStart",
        id: "start",
        next: {
          block: {
            type: "bb_repeat",
            id: "r1",
            fields: { TIMES: 4 },
            inputs: {
              DO: {
                block: {
                  type: "bb_moveForward",
                  id: "m1",
                  next: {
                    block: {
                      type: "bb_ifElse",
                      id: "if1",
                      inputs: {
                        CONDITION: {
                          block: { type: "bb_pathAhead", id: "s1" },
                        },
                        DO: { block: { type: "bb_turnLeft", id: "t1" } },
                        ELSE: { block: { type: "bb_turnRight", id: "t2" } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    ],
  },
};

// ── Block registration ───────────────────────────────────────────────────

describe("block registration (headless Node)", () => {
  it("defines every bb_* block", () => {
    for (const type of BUNNY_BLOCK_TYPES) {
      expect(Blockly.Blocks[type], type).toBeDefined();
    }
  });

  it("loads a workspace using every block type without a DOM", () => {
    const workspace = jsonToWorkspace({
      blocks: {
        languageVersion: 0,
        blocks: [
          {
            type: "bb_whenStart",
            id: "start",
            next: {
              block: {
                type: "bb_repeatUntilGoal",
                id: "r1",
                inputs: {
                  DO: {
                    block: {
                      type: "bb_if",
                      id: "if1",
                      inputs: {
                        CONDITION: { block: { type: "bb_pathAhead", id: "s1" } },
                        DO: {
                          block: {
                            type: "bb_collect",
                            id: "c1",
                            next: {
                              block: {
                                type: "bb_say",
                                id: "sa1",
                                fields: { TEXT: "hi" },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        ],
      },
    });
    expect(workspace.getAllBlocks(false)).toHaveLength(6);
    workspace.dispose();
  });

  it("re-registers with Arabic labels without breaking codegen", () => {
    registerBunnyBlocks("ar");
    try {
      const { display } = generateBoth(NESTED_PROGRAM);
      expect(display).toContain("for (var i = 0; i < 4; i++) {");
    } finally {
      registerBunnyBlocks("en");
    }
  });
});

// ── Codegen ──────────────────────────────────────────────────────────────

describe("codegen (nested program, exact ES5)", () => {
  it("display generator emits the clean program", () => {
    const { display } = generateBoth(NESTED_PROGRAM);
    expect(display).toBe(
      [
        "for (var i = 0; i < 4; i++) {",
        "  moveForward();",
        "  if (!pathAhead()) {",
        "    turnLeft();",
        "  } else {",
        "    turnRight();",
        "  }",
        "}",
        "",
      ].join("\n"),
    );
  });

  it("runnable generator prefixes every statement with highlight()", () => {
    const { runnable } = generateBoth(NESTED_PROGRAM);
    expect(runnable).toBe(
      [
        "highlight('r1');",
        "for (var i = 0; i < 4; i++) {",
        "  highlight('m1');",
        "  moveForward();",
        "  highlight('if1');",
        "  if (!pathAhead()) {",
        "    highlight('t1');",
        "    turnLeft();",
        "  } else {",
        "    highlight('t2');",
        "    turnRight();",
        "  }",
        "}",
        "",
      ].join("\n"),
    );
  });
});

// ── Whitelist + block stats ──────────────────────────────────────────────

describe("validateWhitelist", () => {
  const toolbox: BlockRef[] = [
    { type: "bb_moveForward", limit: 1 },
    { type: "bb_repeat", limit: 1 },
  ];

  it("accepts a program built from the toolbox (hat always allowed)", () => {
    const solution = payloadOf(levelBySlug("repeat-after-me")).solution;
    expect(validateWhitelist(solution, toolbox)).toEqual([]);
  });

  it("catches a forbidden block", () => {
    const violations = validateWhitelist(
      {
        blocks: {
          languageVersion: 0,
          blocks: [
            {
              type: "bb_whenStart",
              id: "start",
              next: { block: { type: "bb_say", id: "s1", fields: { TEXT: "x" } } },
            },
          ],
        },
      },
      toolbox,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain("bb_say");
  });

  it("catches an exceeded instance limit", () => {
    const violations = validateWhitelist(
      {
        blocks: {
          languageVersion: 0,
          blocks: [
            {
              type: "bb_whenStart",
              id: "start",
              next: {
                block: {
                  type: "bb_moveForward",
                  id: "m1",
                  next: { block: { type: "bb_moveForward", id: "m2" } },
                },
              },
            },
          ],
        },
      },
      toolbox,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain("bb_moveForward");
    expect(violations[0]).toContain("limit");
  });
});

describe("computeBlockStats", () => {
  it("counts statement blocks only — hat and sensors excluded", () => {
    const stats = computeBlockStats(NESTED_PROGRAM);
    expect(stats.totalBlocks).toBe(5);
    expect(stats.countsByType).toEqual({
      bb_repeat: 1,
      bb_moveForward: 1,
      bb_ifElse: 1,
      bb_turnLeft: 1,
      bb_turnRight: 1,
    });
  });

  it("returns zero for an empty or hat-only workspace", () => {
    expect(computeBlockStats(undefined).totalBlocks).toBe(0);
    expect(
      computeBlockStats({
        blocks: {
          languageVersion: 0,
          blocks: [{ type: "bb_whenStart", id: "start" }],
        },
      }).totalBlocks,
    ).toBe(0);
  });
});

// ── Headless server codegen end-to-end ───────────────────────────────────

describe("server generateRunnableCode (headless end-to-end)", () => {
  it("generates the exact runnable program for repeat-after-me", () => {
    const level = levelBySlug("repeat-after-me");
    const payload = payloadOf(level);
    const { code, blockStats } = generateRunnableCode(
      payload.solution,
      payload.toolbox,
    );
    expect(code).toBe(
      [
        "highlight('r1');",
        "for (var i = 0; i < 4; i++) {",
        "  highlight('m1');",
        "  moveForward();",
        "}",
        "",
      ].join("\n"),
    );
    expect(blockStats.totalBlocks).toBe(2);
    expect(blockStats.countsByType).toEqual({
      bb_repeat: 1,
      bb_moveForward: 1,
    });
  });

  it("throws WhitelistViolationError for out-of-toolbox blocks", () => {
    const level = levelBySlug("repeat-after-me");
    const solution = payloadOf(levelBySlug("forest-challenge")).solution;
    expect(() =>
      generateRunnableCode(solution, payloadOf(level).toolbox),
    ).toThrow(WhitelistViolationError);
  });
});

// ── Content fixture solutions are loadable, whitelisted programs ─────────

describe("content fixture solutions", () => {
  it("first-hop solution loads and generates the expected code", () => {
    const { display, runnable } = generateBoth(
      payloadOf(levelBySlug("first-hop")).solution,
    );
    expect(display).toBe("moveForward();\n");
    expect(runnable).toBe("highlight('m1');\nmoveForward();\n");
  });

  it("repeat-after-me solution loads and generates the expected code", () => {
    const { display } = generateBoth(
      payloadOf(levelBySlug("repeat-after-me")).solution,
    );
    expect(display).toBe(
      ["for (var i = 0; i < 4; i++) {", "  moveForward();", "}", ""].join("\n"),
    );
  });

  it("every authored solution loads, passes its toolbox, and generates code", () => {
    for (const world of bundle.worlds) {
      for (const worldModule of world.modules) {
        for (const level of worldModule.levels) {
          if (
            level.activityType !== "BLOCK_CODING" &&
            level.activityType !== "DEBUGGING"
          ) {
            continue;
          }
          const payload = payloadOf(level);
          expect(payload.solution, `${level.slug} has a solution`).toBeDefined();
          expect(
            validateWhitelist(payload.solution, payload.toolbox),
            `${level.slug} solution uses only toolbox blocks`,
          ).toEqual([]);
          const { code } = generateRunnableCode(
            payload.solution,
            payload.toolbox,
          );
          expect(code.length, `${level.slug} generates code`).toBeGreaterThan(0);
        }
      }
    }
  });
});
