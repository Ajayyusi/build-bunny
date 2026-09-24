import { Blockly } from "./blockly-core";
import { BLOCK_COLORS } from "./colors";

/**
 * Bunny theme: Zelos geometry (big, rounded, touch-friendly) recoloured
 * with the Play design tokens. Blockly paints SVG fills, so values are the
 * literal hexes behind the --bb-* custom properties in globals.css — keep
 * the two in sync if the palette ever shifts.
 */

// Block category colours (Toy Box) — shared with the tap-to-add palette.
const EVENT = BLOCK_COLORS.event;
const MOTION = BLOCK_COLORS.motion;
const LOOPS = BLOCK_COLORS.loops;
const LOGIC = BLOCK_COLORS.logic;
const SENSING = BLOCK_COLORS.sensing;
const DATA = BLOCK_COLORS.data;
const TRICKS = BLOCK_COLORS.tricks;

export const BunnyTheme = Blockly.Theme.defineTheme("bunny", {
  name: "bunny",
  base: Blockly.Themes.Zelos,
  startHats: true,
  blockStyles: {
    // colourSecondary/Tertiary are derived by Blockly when omitted.
    bunny_event: { colourPrimary: EVENT },
    bunny_motion: { colourPrimary: MOTION },
    bunny_loops: { colourPrimary: LOOPS },
    bunny_logic: { colourPrimary: LOGIC },
    bunny_sensing: { colourPrimary: SENSING },
    bunny_data: { colourPrimary: DATA },
    bunny_tricks: { colourPrimary: TRICKS },
  },
  categoryStyles: {
    bunny_event_category: { colour: EVENT },
    bunny_motion_category: { colour: MOTION },
    bunny_loops_category: { colour: LOOPS },
    bunny_logic_category: { colour: LOGIC },
    bunny_sensing_category: { colour: SENSING },
    bunny_data_category: { colour: DATA },
    bunny_tricks_category: { colour: TRICKS },
  },
  componentStyles: {
    // Toy Box: a clean white building area on a pale-sky shelf.
    workspaceBackgroundColour: "#ffffff",
    toolboxBackgroundColour: "#e6f4ff", // --bb-toy-cloud
    flyoutBackgroundColour: "#e6f4ff", // --bb-toy-cloud
    flyoutOpacity: 1,
    scrollbarColour: "#8fb8dc",
    scrollbarOpacity: 0.6,
    insertionMarkerColour: "#173a63", // --bb-toy-navy
    insertionMarkerOpacity: 0.25,
    selectedGlowColour: "#6b3fd6", // --bb-toy-violet (matches --color-focus)
    selectedGlowOpacity: 0.7,
    cursorColour: "#6b3fd6",
  },
  fontStyle: {
    // Same pair the app's --font-body resolves to; SVG text cannot read
    // CSS variables reliably across Blockly's style injection.
    family: '"Inter", "IBM Plex Sans Arabic", system-ui, sans-serif',
    weight: "600",
  },
});
