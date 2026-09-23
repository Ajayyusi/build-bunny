import type { Block, Workspace } from "blockly/core";
import { Blockly } from "./blockly-core";

/**
 * Two generators over the same bb_* block set (m3 contract):
 *
 * - runnable: fed to js-interpreter. STATEMENT_PREFIX injects
 *   `highlight('<blockId>');` before every statement so playback can light
 *   up the executing block. ES5 only — js-interpreter parses nothing newer.
 * - display: identical program text minus the highlight plumbing, shown to
 *   students in the BLOCKS ⇄ CODE toggle.
 *
 * Built on core's CodeGenerator (not the JavaScript generator): the bunny
 * language has one atomic sensor expression, so operator-precedence
 * machinery would be dead weight, and skipping blockly/javascript keeps the
 * headless Node import surface minimal.
 */

// The only value block is an atomic call — one precedence level suffices.
const ORDER_ATOMIC = 0;

class BunnyGenerator extends Blockly.CodeGenerator {
  /** Monotonic per-generation counter for ES5 loop variable names. */
  private loopCounter = 0;
  /** Any counter block was generated: the program needs `var counter`. */
  usesCounter = false;
  /** The "my trick" definition, hoisted above the program by finish(). */
  trickDefinition: string | null = null;
  /** "do my trick" was generated (with or without a definition). */
  usesTrick = false;

  override init(workspace: Workspace): void {
    super.init(workspace);
    this.loopCounter = 0;
    this.usesCounter = false;
    this.trickDefinition = null;
    this.usesTrick = false;
  }

  /**
   * The program's prologue: the counter variable and the trick definition
   * come first, whatever order the stacks sit in on the canvas. "Do my
   * trick" with no trick taught runs an empty one, so the run reports where
   * the bunny ended up instead of crashing on an undefined function (the
   * player also coaches this before running).
   */
  override finish(code: string): string {
    const prologue: string[] = [];
    if (this.usesCounter) prologue.push("var counter = 0;\n");
    if (this.trickDefinition !== null) prologue.push(this.trickDefinition);
    else if (this.usesTrick) prologue.push("function myTrick() {\n}\n");
    return prologue.join("") + code;
  }

  nextLoopVar(): string {
    this.loopCounter += 1;
    return this.loopCounter === 1 ? "i" : `i${this.loopCounter}`;
  }

  /** Chain a statement block to its `next` sibling. */
  override scrub_(block: Block, code: string, thisOnly?: boolean): string {
    const next = block.nextConnection?.targetBlock() ?? null;
    if (next && !thisOnly) return code + this.blockToCode(next);
    return code;
  }
}

function installForBlock(gen: BunnyGenerator): void {
  // The hat emits nothing (suppressPrefixSuffix set in its definition keeps
  // the highlight prefix away too); scrub_ still walks its `next` chain.
  gen.forBlock["bb_whenStart"] = () => "";

  gen.forBlock["bb_moveForward"] = () => "moveForward();\n";
  gen.forBlock["bb_turnLeft"] = () => "turnLeft();\n";
  gen.forBlock["bb_turnRight"] = () => "turnRight();\n";
  gen.forBlock["bb_collect"] = () => "collect();\n";

  gen.forBlock["bb_say"] = (block) => {
    // JSON.stringify yields a double-quoted, ES5-safe string literal.
    const text = String(block.getFieldValue("TEXT") ?? "");
    return `say(${JSON.stringify(text)});\n`;
  };

  gen.forBlock["bb_repeat"] = (block, generator) => {
    const g = generator as BunnyGenerator;
    const times = Number(block.getFieldValue("TIMES")) || 0;
    const loopVar = g.nextLoopVar();
    const branch = g.statementToCode(block, "DO");
    return `for (var ${loopVar} = 0; ${loopVar} < ${times}; ${loopVar}++) {\n${branch}}\n`;
  };

  gen.forBlock["bb_repeatUntilGoal"] = (block, generator) => {
    // onGoal checked BEFORE each iteration (adjudicated semantics); the
    // engine command budget guarantees termination for goalless programs.
    const branch = (generator as BunnyGenerator).statementToCode(block, "DO");
    return `while (!onGoal()) {\n${branch}}\n`;
  };

  gen.forBlock["bb_if"] = (block, generator) => {
    const g = generator as BunnyGenerator;
    const condition = g.valueToCode(block, "CONDITION", ORDER_ATOMIC) || "false";
    const branch = g.statementToCode(block, "DO");
    return `if (${condition}) {\n${branch}}\n`;
  };

  gen.forBlock["bb_ifElse"] = (block, generator) => {
    const g = generator as BunnyGenerator;
    const condition = g.valueToCode(block, "CONDITION", ORDER_ATOMIC) || "false";
    const doBranch = g.statementToCode(block, "DO");
    const elseBranch = g.statementToCode(block, "ELSE");
    return `if (${condition}) {\n${doBranch}} else {\n${elseBranch}}\n`;
  };

  // The block reads "path ahead is blocked" (curriculum pedagogy) while the
  // engine sensor answers "is the path ahead walkable" — hence the negation.
  gen.forBlock["bb_pathAhead"] = () => ["!pathAhead()", ORDER_ATOMIC];

  // ── Variables: one number, "the counter" ──────────────────────────────
  gen.forBlock["bb_setCounter"] = (block, generator) => {
    (generator as BunnyGenerator).usesCounter = true;
    const value = Number(block.getFieldValue("VALUE")) || 0;
    return `counter = ${value};\n`;
  };
  gen.forBlock["bb_changeCounter"] = (block, generator) => {
    (generator as BunnyGenerator).usesCounter = true;
    const delta = Number(block.getFieldValue("DELTA")) || 0;
    return `counter = counter + ${delta};\n`;
  };
  gen.forBlock["bb_sayCounter"] = (_block, generator) => {
    (generator as BunnyGenerator).usesCounter = true;
    return "say(String(counter));\n";
  };

  // ── Functions: teach a trick, do a trick ──────────────────────────────
  gen.forBlock["bb_defineTrick"] = (block, generator) => {
    const g = generator as BunnyGenerator;
    const body = g.statementToCode(block, "DO");
    g.trickDefinition = `function myTrick() {\n${body}}\n`;
    return ""; // hoisted by finish()
  };
  gen.forBlock["bb_doTrick"] = (_block, generator) => {
    (generator as BunnyGenerator).usesTrick = true;
    return "myTrick();\n";
  };
}

/**
 * Generator for execution in js-interpreter: every statement is preceded by
 * `highlight('<blockId>');` so the interpreter host can log block focus.
 */
export function buildRunnableGenerator(): BunnyGenerator {
  const gen = new BunnyGenerator("BunnyRunnable");
  gen.STATEMENT_PREFIX = "highlight(%1);\n";
  installForBlock(gen);
  return gen;
}

/** Generator for the student-facing code view: clean, no instrumentation. */
export function buildDisplayGenerator(): BunnyGenerator {
  const gen = new BunnyGenerator("BunnyDisplay");
  installForBlock(gen);
  return gen;
}

export type { BunnyGenerator };
