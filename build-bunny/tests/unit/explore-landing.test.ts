import { describe, expect, it } from "vitest";

import { landingNotices, routeProgress } from "@/app/[locale]/(student)/(shell)/explore/_components/landing";

const world = (kind: "ai" | "coding", completedLevels: number, totalLevels: number, horizon = false) =>
  ({ kind, completedLevels, totalLevels, horizon }) as never;

describe("route progress on Explore AI", () => {
  it("counts each route's own worlds, leaving out roadmap and empty worlds", () => {
    expect(
      routeProgress({
        worlds: [
          world("coding", 5, 10),
          world("ai", 2, 15),
          world("coding", 0, 8),
          world("ai", 1, 6),
          world("ai", 0, 12, true),
          world("coding", 0, 0),
        ],
      }),
    ).toEqual({ ai: { done: 3, total: 21 }, coding: { done: 5, total: 18 } });
  });

  it("is zero out of zero with no worlds", () => {
    expect(routeProgress({ worlds: [] })).toEqual({ ai: { done: 0, total: 0 }, coding: { done: 0, total: 0 } });
  });
});

describe("teacher notices on Explore AI", () => {
  it("counts unread messages and assignments still to do", () => {
    expect(landingNotices(2, [{ done: false }, { done: true }, { done: false }])).toEqual({ messages: 2, toDo: 2 });
    expect(landingNotices(0, [{ done: false }])).toEqual({ messages: 0, toDo: 1 });
    expect(landingNotices(1, [])).toEqual({ messages: 1, toDo: 0 });
  });

  it("shows nothing when everything is read and done", () => {
    expect(landingNotices(0, [{ done: true }])).toBeNull();
    expect(landingNotices(0, [])).toBeNull();
  });
});
