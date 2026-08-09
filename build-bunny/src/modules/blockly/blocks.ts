import type { Block } from "blockly/core";
import { Blockly } from "./blockly-core";

/**
 * The bb_* block set (m2/m3 contract adjudication). Field and input names
 * are pinned — content fixtures already serialize TIMES / DO / CONDITION /
 * ELSE / TEXT — so they must never change. Labels are locale-authored here
 * rather than through Blockly's message catalog: the set is small, and the
 * Arabic must be real classroom copy, not machine bulk-translation.
 */

export type BlockLocale = "en" | "ar";

export const BUNNY_HAT_BLOCK = "bb_whenStart";

/** Value (sensor) blocks — excluded from BlockStats per engine contract. */
export const BUNNY_SENSOR_BLOCKS = ["bb_pathAhead"] as const;

/** Statement blocks — the only blocks BlockStats counts. */
export const BUNNY_STATEMENT_BLOCKS = [
  "bb_moveForward",
  "bb_turnLeft",
  "bb_turnRight",
  "bb_collect",
  "bb_say",
  "bb_repeat",
  "bb_repeatUntilGoal",
  "bb_if",
  "bb_ifElse",
] as const;

export const BUNNY_BLOCK_TYPES = [
  BUNNY_HAT_BLOCK,
  ...BUNNY_STATEMENT_BLOCKS,
  ...BUNNY_SENSOR_BLOCKS,
] as const;

export type BunnyBlockType = (typeof BUNNY_BLOCK_TYPES)[number];

interface BlockLabels {
  whenStart: string;
  moveForward: string;
  turnLeft: string;
  turnRight: string;
  collect: string;
  say: string;
  repeat: string;
  repeatUntilGoal: string;
  if_: string;
  ifElse: string;
  pathAhead: string;
}

// %1/%2/%3 are Blockly interpolation slots; their order is part of the
// message, so each locale can place inputs naturally.
const LABELS: Record<BlockLocale, BlockLabels> = {
  en: {
    whenStart: "when start",
    moveForward: "move forward",
    turnLeft: "turn left ↺",
    turnRight: "turn right ↻",
    collect: "collect",
    say: "say %1",
    repeat: "repeat %1 times %2",
    repeatUntilGoal: "repeat until I reach the goal %1",
    if_: "if %1 do %2",
    ifElse: "if %1 do %2 else %3",
    pathAhead: "path ahead is blocked",
  },
  ar: {
    whenStart: "عند البدء",
    moveForward: "تقدّم للأمام",
    turnLeft: "استدر يسارًا ↺",
    turnRight: "استدر يمينًا ↻",
    collect: "التقط",
    say: "قل %1",
    repeat: "كرّر %1 مرة %2",
    repeatUntilGoal: "كرّر حتى أصل إلى الهدف %1",
    if_: "إذا %1 نفّذ %2",
    ifElse: "إذا %1 نفّذ %2 وإلا %3",
    pathAhead: "الطريق أمامي مسدود",
  },
};

/** Which locale the currently registered definitions were built with. */
let registeredLocale: BlockLocale | null = null;

/**
 * Define (or re-define, on locale switch) every bb_* block. Idempotent per
 * locale; safe to call before any workspace load, headless or rendered.
 */
export function registerBunnyBlocks(locale: BlockLocale = "en"): void {
  if (registeredLocale === locale) return;
  const L = LABELS[locale];

  const jsonDefs: Record<BunnyBlockType, Record<string, unknown>> = {
    bb_whenStart: {
      type: "bb_whenStart",
      message0: L.whenStart,
      nextStatement: null,
      style: "bunny_event",
      hat: "cap",
    },
    bb_moveForward: {
      type: "bb_moveForward",
      message0: L.moveForward,
      previousStatement: null,
      nextStatement: null,
      style: "bunny_motion",
    },
    bb_turnLeft: {
      type: "bb_turnLeft",
      message0: L.turnLeft,
      previousStatement: null,
      nextStatement: null,
      style: "bunny_motion",
    },
    bb_turnRight: {
      type: "bb_turnRight",
      message0: L.turnRight,
      previousStatement: null,
      nextStatement: null,
      style: "bunny_motion",
    },
    bb_collect: {
      type: "bb_collect",
      message0: L.collect,
      previousStatement: null,
      nextStatement: null,
      style: "bunny_motion",
    },
    bb_say: {
      type: "bb_say",
      message0: L.say,
      args0: [{ type: "field_input", name: "TEXT", text: "" }],
      previousStatement: null,
      nextStatement: null,
      style: "bunny_motion",
    },
    bb_repeat: {
      type: "bb_repeat",
      message0: L.repeat,
      args0: [
        {
          type: "field_number",
          name: "TIMES",
          value: 4,
          min: 1,
          max: 10,
          precision: 1,
        },
        { type: "input_statement", name: "DO" },
      ],
      previousStatement: null,
      nextStatement: null,
      style: "bunny_loops",
    },
    bb_repeatUntilGoal: {
      type: "bb_repeatUntilGoal",
      message0: L.repeatUntilGoal,
      args0: [{ type: "input_statement", name: "DO" }],
      previousStatement: null,
      nextStatement: null,
      style: "bunny_loops",
    },
    bb_if: {
      type: "bb_if",
      message0: L.if_,
      args0: [
        { type: "input_value", name: "CONDITION", check: "Boolean" },
        { type: "input_statement", name: "DO" },
      ],
      previousStatement: null,
      nextStatement: null,
      style: "bunny_logic",
    },
    bb_ifElse: {
      type: "bb_ifElse",
      message0: L.ifElse,
      args0: [
        { type: "input_value", name: "CONDITION", check: "Boolean" },
        { type: "input_statement", name: "DO" },
        { type: "input_statement", name: "ELSE" },
      ],
      previousStatement: null,
      nextStatement: null,
      style: "bunny_logic",
    },
    bb_pathAhead: {
      type: "bb_pathAhead",
      message0: L.pathAhead,
      output: "Boolean",
      style: "bunny_sensing",
    },
  };

  for (const type of BUNNY_BLOCK_TYPES) {
    const def = jsonDefs[type];
    Blockly.Blocks[type] = {
      init(this: Block) {
        this.jsonInit(def);
        // The hat is scaffolding, not part of the student's program: the
        // runnable generator's highlight STATEMENT_PREFIX must skip it.
        if (type === BUNNY_HAT_BLOCK) this.suppressPrefixSuffix = true;
      },
    };
  }

  registeredLocale = locale;
}
