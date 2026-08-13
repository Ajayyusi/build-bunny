import type { Grid, RGB } from "./types";

/**
 * Box-average (area) downsampling: each output cell is the mean of the
 * source cells whose proportional range falls under it. This is the real
 * operation behind the resolution slider — "12 pixels" genuinely means the
 * image was averaged down to a 12-wide grid, not just displayed smaller.
 */
export function downsampleGrid(
  grid: Grid<number>,
  targetRows: number,
  targetCols: number,
): number[][] {
  const height = grid.length;
  const width = grid[0]?.length ?? 0;
  const out: number[][] = [];
  for (let oy = 0; oy < targetRows; oy++) {
    const y0 = Math.floor((oy * height) / targetRows);
    const y1 = Math.max(y0 + 1, Math.floor(((oy + 1) * height) / targetRows));
    const row: number[] = [];
    for (let ox = 0; ox < targetCols; ox++) {
      const x0 = Math.floor((ox * width) / targetCols);
      const x1 = Math.max(x0 + 1, Math.floor(((ox + 1) * width) / targetCols));
      let sum = 0;
      let count = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          sum += grid[y]![x]!;
          count++;
        }
      }
      row.push(count > 0 ? sum / count : 0);
    }
    out.push(row);
  }
  return out;
}

/** Same box-average, applied per channel — reuses downsampleGrid rather than re-deriving the arithmetic. */
export function downsampleRGB(pixels: Grid<RGB>, targetRows: number, targetCols: number): RGB[][] {
  const r = downsampleGrid(
    pixels.map((row) => row.map((p) => p.r)),
    targetRows,
    targetCols,
  );
  const g = downsampleGrid(
    pixels.map((row) => row.map((p) => p.g)),
    targetRows,
    targetCols,
  );
  const b = downsampleGrid(
    pixels.map((row) => row.map((p) => p.b)),
    targetRows,
    targetCols,
  );
  const out: RGB[][] = [];
  for (let y = 0; y < targetRows; y++) {
    const row: RGB[] = [];
    for (let x = 0; x < targetCols; x++) {
      row.push({ r: r[y]![x]!, g: g[y]![x]!, b: b[y]![x]! });
    }
    out.push(row);
  }
  return out;
}
