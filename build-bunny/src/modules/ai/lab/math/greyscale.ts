import type { Grid, RGB } from "./types";

/**
 * Rec. 601 luma weights — the standard, simple "how bright does this pixel
 * look to a person" formula. Plenty honest for a kids' pixel-playground
 * without pulling in a colour-science dependency.
 */
export function greyscaleValue({ r, g, b }: RGB): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

export function greyscaleGrid(pixels: Grid<RGB>): number[][] {
  return pixels.map((row) => row.map(greyscaleValue));
}
