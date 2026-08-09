import * as BlocklyModule from "blockly/core";

/**
 * Dual-environment Blockly entry point. Browser bundlers resolve
 * "blockly/core" to blockly.mjs (real named ESM exports); Node's "node"
 * export condition yields core-node.js, a CJS bundle whose whole API lands
 * on the namespace's `default` (cjs-module-lexer cannot see through its
 * `module.exports = Blockly` indirection). Every blockly module — headless
 * server codegen included — must import Blockly from here so both
 * environments see the same object.
 */
type BlocklyApi = typeof BlocklyModule;

const maybeDefault = (BlocklyModule as unknown as { default?: BlocklyApi }).default;

export const Blockly: BlocklyApi =
  maybeDefault && typeof maybeDefault.Workspace === "function"
    ? maybeDefault
    : BlocklyModule;
