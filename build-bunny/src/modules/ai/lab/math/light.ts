import { greyscaleValue } from "./greyscale";
import type { Grid, RGB } from "./types";

/**
 * Lighting (handoff: compare shapes under different lighting). Dimmer or
 * brighter light scales every colour number, clamped to 0-255: the same
 * picture reaches the computer as completely different numbers.
 */
export function applyLight(grid: Grid<RGB>, factor: number): RGB[][] {
  const clamp = (v: number) => Math.max(0, Math.min(255, v * factor));
  return grid.map((row) => row.map(({ r, g, b }) => ({ r: clamp(r), g: clamp(g), b: clamp(b) })));
}

/** The picture's average brightness (0-255), to show how the numbers moved. */
export function averageBrightness(grid: Grid<RGB>): number {
  let sum = 0;
  let n = 0;
  for (const row of grid) for (const pixel of row) {
    sum += greyscaleValue(pixel);
    n += 1;
  }
  return n === 0 ? 0 : sum / n;
}
