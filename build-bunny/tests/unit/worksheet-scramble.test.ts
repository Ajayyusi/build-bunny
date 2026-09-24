import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ db: {} }));

const { scramble } = await import("@/modules/curriculum/server/worksheet");

const steps = (ids: string[]) => ids.map((id) => ({ id }));

describe("worksheet scramble", () => {
  it("never prints any step in its answer position, and is stable", () => {
    for (const ids of [
      ["a", "b", "c"],
      ["wake", "wash", "dress", "eat"],
      ["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8"],
    ]) {
      const once = scramble(steps(ids), ids).map((s) => s.id);
      once.forEach((id, index) => expect(id).not.toBe(ids[index]));
      expect([...once].sort()).toEqual([...ids].sort());
      expect(scramble(steps(ids), ids).map((s) => s.id)).toEqual(once);
    }
  });

  it("rotates when the fixed shuffle happens to equal the answer", () => {
    const ids = ["a", "b", "c"];
    const natural = scramble(steps(ids), ["x"]).map((s) => s.id);
    // Use the natural shuffle as the "answer": the sheet must still differ.
    expect(scramble(steps(ids), natural).map((s) => s.id)).not.toEqual(natural);
  });
});

const { outlineProgram } = await import("@/modules/curriculum/server/worksheet");

describe("worksheet program outline", () => {
  it("prints the main program, nested bodies, else branches and a trick", () => {
    const workspace = {
      blocks: {
        blocks: [
          {
            type: "bb_whenStart",
            next: {
              block: {
                type: "bb_repeat",
                fields: { TIMES: 3 },
                inputs: {
                  DO: {
                    block: {
                      type: "bb_ifElse",
                      inputs: {
                        CONDITION: { block: { type: "bb_pathAhead" } },
                        DO: { block: { type: "bb_moveForward" } },
                        ELSE: { block: { type: "bb_turnLeft" } },
                      },
                    },
                  },
                },
                next: { block: { type: "bb_doTrick" } },
              },
            },
          },
          { type: "bb_defineTrick", inputs: { DO: { block: { type: "bb_say", fields: { TEXT: "hi" } } } } },
          { type: "bb_moveForward" }, // loose block: not part of the program
        ],
      },
    };
    expect(outlineProgram(workspace)).toEqual([
      { depth: 0, type: "bb_repeat", value: 3 },
      { depth: 1, type: "bb_ifElse", condition: "bb_pathAhead" },
      { depth: 2, type: "bb_moveForward" },
      { depth: 1, type: "else" },
      { depth: 2, type: "bb_turnLeft" },
      { depth: 0, type: "bb_doTrick" },
      { depth: 0, type: "bb_defineTrick" },
      { depth: 1, type: "bb_say", value: "hi" },
    ]);
    expect(outlineProgram(null)).toEqual([]);
    expect(outlineProgram({ blocks: { blocks: "nope" } })).toEqual([]);
  });
});
