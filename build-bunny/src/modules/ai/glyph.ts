/**
 * How a specimen is DRAWN — one module, shared by every AI player and every
 * explanation animation.
 *
 * This exists for the same reason knn.ts does. The board and the walkthrough
 * currently agree on what a berry looks like because someone re-typed
 * `26 + size * 26` and `250 + color * 110` into both files and left a comment
 * saying "same hue ramp as the board". That is a promise, not a mechanism,
 * and a child who is taught with one visual vocabulary and tested with
 * another has been lied to by the software.
 *
 * The two formulas are the entire visual grammar of these activities: a
 * specimen's DIAMETER is one feature and its HUE is the other, so a child can
 * read both measurements off the glyph without being told a number. Every
 * theme is the same grammar in a different costume.
 */

export type GlyphShape = "circle" | "diamond" | "hex";

export interface GlyphTheme {
  shape: GlyphShape;
  /** Hue in degrees at color = 0. */
  hueFrom: number;
  /** Degrees swept as color goes 0 → 1. */
  hueSpan: number;
  pxMin: number;
  pxMax: number;
}

/**
 * Hue ramps deliberately avoid passing through green and yellow. The first
 * berry ramp ran 220° → 10°, which crosses both, so mid-range berries came
 * out leaf-green — and green reads as "safe" to a child regardless of which
 * side of the rule the specimen is actually on. The colour must carry the
 * measurement and nothing else.
 */
export const GLYPH_THEMES = {
  /** AI Island. 250° violet → 360° red. */
  berry: { shape: "circle", hueFrom: 250, hueSpan: 110, pxMin: 26, pxMax: 52 },
  /**
   * Data Desert. 45° sand → −80° (≡ 280°) violet, i.e. sweeping DOWNWARD
   * through red rather than upward through green. The obvious desert ramp
   * (sand 38° → slate 208°) crosses the green/yellow band and reintroduces
   * exactly the bug the berry ramp was fixed for. CSS wraps negative hue
   * angles, so the negative span needs no special handling.
   */
  grain: { shape: "diamond", hueFrom: 45, hueSpan: -125, pxMin: 24, pxMax: 48 },
  /** ML Lab. 190° cyan → 360° red — already clear of the green band. */
  cell: { shape: "hex", hueFrom: 190, hueSpan: 170, pxMin: 26, pxMax: 50 },
} satisfies Record<string, GlyphTheme>;

export type GlyphThemeName = keyof typeof GLYPH_THEMES;

/** The default keeps every already-authored level pixel-identical. */
export const DEFAULT_GLYPH_THEME: GlyphThemeName = "berry";

export function glyphTheme(name: string | undefined): GlyphTheme {
  return GLYPH_THEMES[(name ?? DEFAULT_GLYPH_THEME) as GlyphThemeName] ?? GLYPH_THEMES.berry;
}

/** Diameter in px. Feature 1 (`size`) read straight off the glyph. */
export function glyphPx(theme: GlyphTheme, size: number): number {
  return theme.pxMin + Math.round(size * (theme.pxMax - theme.pxMin));
}

/** Hue in degrees. Feature 2 (`color`) read straight off the glyph. */
export function glyphHue(theme: GlyphTheme, color: number): number {
  return Math.round(theme.hueFrom + color * theme.hueSpan);
}

/** The fill a specimen is painted with, lit from the same corner every time. */
export function glyphFill(theme: GlyphTheme, color: number): string {
  const hue = glyphHue(theme, color);
  return `radial-gradient(circle at 32% 30%, hsl(${hue} 85% 72%), hsl(${hue} 70% 48%))`;
}

/** Unknown specimens: no hue, because their measurement is what's in question. */
export const MYSTERY_FILL =
  "repeating-linear-gradient(45deg, hsl(230 12% 82%), hsl(230 12% 82%) 5px, hsl(230 12% 88%) 5px, hsl(230 12% 88%) 10px)";

/**
 * Shape as CSS. Circle stays a border-radius so the existing berry renders
 * byte-identically; the other two are clip-paths, which is why they carry
 * their outline as an inset shadow rather than a border (a border is drawn
 * outside the clip and would be sliced off).
 */
export function glyphShapeStyle(theme: GlyphTheme): React.CSSProperties {
  switch (theme.shape) {
    case "diamond":
      return { clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)" };
    case "hex":
      return {
        clipPath: "polygon(25% 5%, 75% 5%, 100% 50%, 75% 95%, 25% 95%, 0% 50%)",
      };
    default:
      return { borderRadius: "9999px" };
  }
}

/**
 * The feature-space point a tint cell represents. Lives here, in the one
 * dependency-free module of this feature area, so the orientation test can
 * import it without dragging the player's UI dependencies into vitest.
 *
 * The grid renders row 0 at the TOP, but specimens are plotted with
 * `bottom: color%` — colour increases UPWARD from the bottom edge. So the
 * row axis must be inverted here, and the first version of this board did
 * not: it painted the "safe" region exactly where the unsafe berries sat,
 * which for a child is not a rendering bug but the machine visibly lying.
 * Cell centres, so no sample sits exactly on an axis edge.
 */
export function tintCellFeatures(
  row: number,
  col: number,
  steps: number,
): { size: number; color: number } {
  return {
    size: (col + 0.5) / steps,
    color: 1 - (row + 0.5) / steps,
  };
}

