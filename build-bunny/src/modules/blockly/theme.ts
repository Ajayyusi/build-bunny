import { Blockly } from "./blockly-core";

/**
 * Bunny theme: Zelos geometry (big, rounded, touch-friendly) recoloured
 * with the Play design tokens. Blockly paints SVG fills, so values are the
 * literal hexes behind the --bb-* custom properties in globals.css — keep
 * the two in sync if the palette ever shifts.
 */

// Block category colours — each is the token step whose white-label
// contrast is strongest in its ramp while staying friendly, not muddy.
const EVENT = "#b57c04"; // --bb-star-600
const MOTION = "#2e7d32"; // --bb-meadow-600 (was meadow-500; the new NITAQ
// green's 500 step reads too light with white labels — 2.78:1, under AA)
const LOOPS = "#00786a"; // --bb-sky-600
const LOGIC = "#d14a2e"; // --bb-coral-500
const SENSING = "#5c6873"; // --bb-slate-600

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
  },
  categoryStyles: {
    bunny_event_category: { colour: EVENT },
    bunny_motion_category: { colour: MOTION },
    bunny_loops_category: { colour: LOOPS },
    bunny_logic_category: { colour: LOGIC },
    bunny_sensing_category: { colour: SENSING },
  },
  componentStyles: {
    workspaceBackgroundColour: "#fdfbf7", // --bb-cream-50
    toolboxBackgroundColour: "#f8f4ea", // --bb-cream-100
    flyoutBackgroundColour: "#f8f4ea", // --bb-cream-100
    flyoutOpacity: 1,
    scrollbarColour: "#cbbe9f", // --bb-cream-400
    scrollbarOpacity: 0.55,
    insertionMarkerColour: "#292724", // --bb-ink-900
    insertionMarkerOpacity: 0.25,
    selectedGlowColour: "#00897b", // --bb-sky-500 (matches --color-focus)
    selectedGlowOpacity: 0.6,
    cursorColour: "#00897b", // --bb-sky-500
  },
  fontStyle: {
    // Same pair the app's --font-body resolves to; SVG text cannot read
    // CSS variables reliably across Blockly's style injection.
    family: '"Inter", "IBM Plex Sans Arabic", system-ui, sans-serif',
    weight: "600",
  },
});
