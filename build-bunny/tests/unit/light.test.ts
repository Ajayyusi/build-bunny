import { describe, expect, it } from "vitest";

import { applyLight, averageBrightness } from "@/modules/ai/lab/math/light";

describe("lighting (same picture, different numbers)", () => {
  const grid = [[{ r: 100, g: 100, b: 100 }, { r: 200, g: 50, b: 0 }]];

  it("scales every colour number, clamped to 0-255", () => {
    expect(applyLight(grid, 0.5)).toEqual([[{ r: 50, g: 50, b: 50 }, { r: 100, g: 25, b: 0 }]]);
    expect(applyLight(grid, 1.6)[0]![1]).toEqual({ r: 255, g: 80, b: 0 });
  });

  it("moves the average brightness, the number a child sees", () => {
    const normal = averageBrightness(grid);
    expect(averageBrightness(applyLight(grid, 0.4))).toBeCloseTo(normal * 0.4, 5);
    expect(averageBrightness([])).toBe(0);
  });
});
