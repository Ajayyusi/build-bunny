import type { Grid, Kernel3x3 } from "./types";

/**
 * The "See Like a Computer" edge-detection preset — a discrete Laplacian.
 * Sums to zero, so a flat region (no edge) convolves to ~0; a sharp change
 * lights up. The kernel is editable in the widget; this is just its default.
 */
export const EDGE_DETECTION_KERNEL: Kernel3x3 = [
  [-1, -1, -1],
  [-1, 8, -1],
  [-1, -1, -1],
];

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * A real 3x3 convolution over a single-channel grid, edge-clamped (the
 * nearest in-bounds pixel is reused past the border, "replicate" padding —
 * simple and has no dark-border artefact for a kids' tool). Same function
 * the pixel-playground widget applies live and nothing else runs server-side
 * (this widget's grading never depends on the kernel, only on round
 * identification), kept here because it's still "the maths a child sees".
 */
export function convolve3x3(grid: Grid<number>, kernel: Kernel3x3): number[][] {
  const height = grid.length;
  const width = grid[0]?.length ?? 0;
  const out: number[][] = [];
  for (let y = 0; y < height; y++) {
    const row: number[] = [];
    for (let x = 0; x < width; x++) {
      let sum = 0;
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const sourceY = clamp(y + ky, 0, height - 1);
          const sourceX = clamp(x + kx, 0, width - 1);
          sum += grid[sourceY]![sourceX]! * kernel[ky + 1]![kx + 1]!;
        }
      }
      row.push(sum);
    }
    out.push(row);
  }
  return out;
}
