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

/**
 * The `default` lookup goes through a computed key on purpose.
 *
 * Written as `BlocklyModule.default`, the browser build resolves
 * "blockly/core" to the ESM bundle, sees a static default access on a
 * namespace that genuinely has no default export, and emits "Attempted
 * import error: 'blockly/core' does not contain a default export" on every
 * production build. The access is correct — it is the CJS path that needs it
 * — but statically it looks like a mistake. A computed key is the same
 * lookup at runtime while leaving nothing for the bundler to mis-resolve.
 *
 * Probing `Workspace` first means the browser path never reaches for
 * `default` at all.
 */
const DEFAULT_EXPORT_KEY = "default";

function resolveBlockly(): BlocklyApi {
  const namespace = BlocklyModule as unknown as Record<string, unknown>;
  if (typeof (namespace.Workspace as unknown) === "function") {
    return BlocklyModule;
  }
  const fallback = namespace[DEFAULT_EXPORT_KEY] as BlocklyApi | undefined;
  if (fallback && typeof fallback.Workspace === "function") {
    return fallback;
  }
  return BlocklyModule;
}

export const Blockly: BlocklyApi = resolveBlockly();
