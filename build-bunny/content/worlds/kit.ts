/**
 * Small authoring kit for block programs and bilingual text in content
 * fixtures. Only builds plain JSON — the same serialized Blockly shape every
 * fixture already uses — so the publish gates see nothing special.
 */

export type Node = Record<string, unknown>;

export const t = (en: string, ar: string) => ({ en, ar });

/** Four hint tiers from four [en, ar] pairs, smallest nudge first. */
export const hints = (...pairs: [string, string][]) =>
  pairs.map(([en, ar], index) => ({ tier: index + 1, text: { en, ar } }));

export const startWorkspace = {
  blocks: {
    languageVersion: 0,
    blocks: [{ type: "bb_whenStart", id: "start", x: 24, y: 24, deletable: false, movable: false }],
  },
};

export function chain(...blocks: Node[]): Node {
  let next: Node | undefined;
  for (let i = blocks.length - 1; i >= 0; i -= 1) {
    const block = { ...blocks[i] };
    if (next) block["next"] = { block: next };
    next = block;
  }
  return next!;
}

/** A whole workspace: "when start" followed by these blocks, in order. */
export function hat(...program: Node[]) {
  return withTops([], ...program);
}

/** Like hat(), plus extra top-level blocks beside the program (a trick definition). */
export function withTops(extraTops: Node[], ...program: Node[]) {
  return {
    blocks: {
      languageVersion: 0,
      blocks: [
        {
          type: "bb_whenStart",
          id: "start",
          x: 24,
          y: 24,
          deletable: false,
          movable: false,
          ...(program.length ? { next: { block: chain(...program) } } : {}),
        },
        ...extraTops,
      ],
    },
  };
}

let seq = 0;
const id = (prefix: string) => `${prefix}${(seq += 1)}`;

export const move = (): Node => ({ type: "bb_moveForward", id: id("m") });
export const left = (): Node => ({ type: "bb_turnLeft", id: id("l") });
export const right = (): Node => ({ type: "bb_turnRight", id: id("r") });
export const collect = (): Node => ({ type: "bb_collect", id: id("c") });
export const repeat = (times: number, ...body: Node[]): Node => ({
  type: "bb_repeat",
  id: id("rep"),
  fields: { TIMES: times },
  inputs: { DO: { block: chain(...body) } },
});
export const untilGoal = (...body: Node[]): Node => ({
  type: "bb_repeatUntilGoal",
  id: id("u"),
  inputs: { DO: { block: chain(...body) } },
});
const blocked = (): Node => ({ type: "bb_pathAhead", id: id("s") });
export const ifBlocked = (...body: Node[]): Node => ({
  type: "bb_if",
  id: id("if"),
  inputs: { CONDITION: { block: blocked() }, DO: { block: chain(...body) } },
});
export const ifElseBlocked = (yes: Node[], no: Node[]): Node => ({
  type: "bb_ifElse",
  id: id("ie"),
  inputs: {
    CONDITION: { block: blocked() },
    DO: { block: chain(...yes) },
    ELSE: { block: chain(...no) },
  },
});
export const setCounter = (value: number): Node => ({ type: "bb_setCounter", id: id("sc"), fields: { VALUE: value } });
export const addCounter = (delta: number): Node => ({ type: "bb_changeCounter", id: id("ac"), fields: { DELTA: delta } });
export const sayCounter = (): Node => ({ type: "bb_sayCounter", id: id("say") });
export const doTrick = (): Node => ({ type: "bb_doTrick", id: id("do") });
export const trick = (...body: Node[]): Node => ({
  type: "bb_defineTrick",
  id: id("def"),
  x: 320,
  y: 24,
  inputs: { DO: { block: chain(...body) } },
});
