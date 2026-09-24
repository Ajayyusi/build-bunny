/**
 * Block category colours (Toy Box). One source for the Blockly theme and the
 * tap-to-add palette, so a block and its palette button always match. Every
 * colour carries a white label at ≥ 4.5:1.
 */
export const BLOCK_COLORS = {
  event: "#c2410c", // "when start" — orange (5.2:1)
  motion: "#1b64c6", // move / turn / collect / say — blue (5.7:1)
  loops: "#257a35", // repeat — green (5.4:1)
  logic: "#c92a5c", // if / if-else — berry (5.3:1)
  sensing: "#0f766e", // path ahead — teal (5.5:1)
  data: "#6b3fd6", // counters — violet (6.4:1)
  tricks: "#a15c00", // my trick — amber (5.2:1)
} as const;

/** Which colour each block type wears. */
export const BLOCK_COLOR_BY_TYPE: Record<string, string> = {
  bb_whenStart: BLOCK_COLORS.event,
  bb_moveForward: BLOCK_COLORS.motion,
  bb_turnLeft: BLOCK_COLORS.motion,
  bb_turnRight: BLOCK_COLORS.motion,
  bb_collect: BLOCK_COLORS.motion,
  bb_say: BLOCK_COLORS.motion,
  bb_repeat: BLOCK_COLORS.loops,
  bb_repeatUntilGoal: BLOCK_COLORS.loops,
  bb_if: BLOCK_COLORS.logic,
  bb_ifElse: BLOCK_COLORS.logic,
  bb_pathAhead: BLOCK_COLORS.sensing,
  bb_setCounter: BLOCK_COLORS.data,
  bb_changeCounter: BLOCK_COLORS.data,
  bb_sayCounter: BLOCK_COLORS.data,
  bb_defineTrick: BLOCK_COLORS.tricks,
  bb_doTrick: BLOCK_COLORS.tricks,
};
