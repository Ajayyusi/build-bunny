import { describe, expect, it } from "vitest";

import {
  tintCellFeatures,
  glyphFill,
  glyphHue,
  glyphPx,
  glyphShapeStyle,
  glyphTheme,
  GLYPH_THEMES,
} from "@/modules/ai/glyph";

/**
 * The glyph is how a child READS a specimen's two measurements without being
 * shown a number, so its geometry is part of the curriculum, not decoration.
 * These are pinned values: a refactor that shifts the berry ramp changes what
 * every AI Island screenshot, worksheet and teacher explanation means.
 */
describe("glyph geometry", () => {
  const berry = GLYPH_THEMES.berry;

  it("maps size across the full diameter range", () => {
    expect(glyphPx(berry, 0)).toBe(26);
    expect(glyphPx(berry, 1)).toBe(52);
    expect(glyphPx(berry, 0.5)).toBe(39);
  });

  it("maps colour across the berry ramp, violet to red", () => {
    expect(glyphHue(berry, 0)).toBe(250);
    expect(glyphHue(berry, 1)).toBe(360);
  });

  it("never routes a hue ramp through green or yellow", () => {
    // 60°-160° is the green/yellow band. A specimen rendered leaf-green reads
    // as "safe" to a child whichever side of the rule it is actually on —
    // the first berry ramp ran 220° → 10° and did exactly that.
    for (const [name, theme] of Object.entries(GLYPH_THEMES)) {
      for (let c = 0; c <= 1.0001; c += 0.05) {
        const hue = ((glyphHue(theme, Math.min(c, 1)) % 360) + 360) % 360;
        expect(hue > 60 && hue < 160, `${name} hits ${hue}° at colour ${c.toFixed(2)}`).toBe(
          false,
        );
      }
    }
  });

  it("falls back to the berry theme for an unknown or absent name", () => {
    // Every already-authored level omits `theme`; they must not change.
    expect(glyphTheme(undefined)).toEqual(berry);
    expect(glyphTheme("no-such-theme")).toEqual(berry);
    expect(glyphTheme("grain")).toEqual(GLYPH_THEMES.grain);
  });

  it("keeps the berry a border-radius circle so existing levels are pixel-identical", () => {
    expect(glyphShapeStyle(berry)).toEqual({ borderRadius: "9999px" });
    expect(glyphShapeStyle(GLYPH_THEMES.grain).clipPath).toContain("polygon");
  });

  it("lights every specimen from the same corner", () => {
    // A gradient whose highlight moved with the value would add a third
    // visual channel the child would try to read as a measurement.
    expect(glyphFill(berry, 0.3)).toContain("circle at 32% 30%");
  });
});

describe("feature board tint orientation", () => {
  // The board plots specimens with `bottom: color%` — colour grows upward.
  // The tint grid renders row 0 at the top, so its mapping must invert the
  // row axis. The first version did not, and painted "safe" exactly where
  // the unsafe berries sat: to a child, the machine visibly lying.
  it("maps the top row to high colour and the bottom row to low", () => {
    const steps = 24;
    expect(tintCellFeatures(0, 0, steps).color).toBeGreaterThan(0.9);
    expect(tintCellFeatures(steps - 1, 0, steps).color).toBeLessThan(0.1);
    // Columns are not inverted: size grows left to right.
    expect(tintCellFeatures(0, 0, steps).size).toBeLessThan(0.1);
    expect(tintCellFeatures(0, steps - 1, steps).size).toBeGreaterThan(0.9);
    // A cell and the specimen at the same visual position agree exactly:
    // centre of the grid is the centre of the space.
    const mid = tintCellFeatures(steps / 2, steps / 2, steps);
    expect(mid.size).toBeCloseTo(0.5, 1);
    expect(mid.color).toBeCloseTo(0.5, 1);
  });
});
