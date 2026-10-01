import { describe, expect, it } from "vitest";

import { summariseFirstSession } from "@/modules/analytics/first-session";

describe("the first session, timed (handoff: 5 to 8 minutes)", () => {
  it("stays hidden under five children", () => {
    expect(summariseFirstSession([6, 7, 5, 9])).toBeNull();
  });

  it("gives the median and how many finished within 8 minutes", () => {
    expect(summariseFirstSession([6, 7, 5, 9, 12])).toEqual({ children: 5, medianMinutes: 7, withinTarget: 3 });
    expect(summariseFirstSession([4, 6, 7, 5, 9, 12])).toEqual({ children: 6, medianMinutes: 6.5, withinTarget: 4 });
  });
});
