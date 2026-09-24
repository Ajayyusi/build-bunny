/**
 * Toy Box world colours: one bold colour per world family, used for the
 * world cards on the home screen, the world bands on the map and the game
 * board, so a world reads as "the same place" everywhere.
 *
 * - `fill` carries white text at ≥ 4.5:1 (checked for text-xs).
 * - `ledge` is the darker shade drawn under a card as its press-able edge.
 * - `tile` is a bright pastel of the same hue: the board's ground and the
 *   map band (dark text on it).
 *
 * World themes are authored content strings, so match by substring and
 * always fall back.
 */
export interface WorldColor {
  fill: string;
  ledge: string;
  tile: string;
}

const WORLD_COLORS: ReadonlyArray<readonly [string, WorldColor]> = [
  ["meadow", { fill: "#257a35", ledge: "#1b5e28", tile: "#b8ec9a" }],
  ["forest", { fill: "#0f766e", ledge: "#0a4f4a", tile: "#9fe3d4" }],
  ["robot", { fill: "#6b3fd6", ledge: "#4a2a9a", tile: "#d9ccff" }],
  ["city", { fill: "#1b64c6", ledge: "#134689", tile: "#bfe0ff" }],
  ["island", { fill: "#c92a5c", ledge: "#8f1d42", tile: "#ffc9da" }],
  ["desert", { fill: "#c2410c", ledge: "#8a2e08", tile: "#ffd6a8" }],
  ["ml", { fill: "#4338ca", ledge: "#2e268f", tile: "#cdd0ff" }],
  ["lab", { fill: "#4338ca", ledge: "#2e268f", tile: "#cdd0ff" }],
  ["workshop", { fill: "#a15c00", ledge: "#6e3f00", tile: "#ffe2a6" }],
  ["inventor", { fill: "#a15c00", ledge: "#6e3f00", tile: "#ffe2a6" }],
];

const FALLBACK: WorldColor = { fill: "#1b64c6", ledge: "#134689", tile: "#bfe0ff" };

export function worldColor(theme: string): WorldColor {
  const needle = theme.toLowerCase();
  for (const [key, color] of WORLD_COLORS) {
    if (needle.includes(key)) return color;
  }
  return FALLBACK;
}

/** A colour (#rrggbb) mixed toward white (share = how much colour, 0–1). */
export function tintHex(hex: string, share: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (shift: number) => Math.round(255 - (255 - ((n >> shift) & 255)) * share);
  return `rgb(${ch(16)} ${ch(8)} ${ch(0)})`;
}
