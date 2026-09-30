import { describe, expect, it } from "vitest";

import { settingsForChild, type ClassActivitySetting } from "@/modules/explore/launch";

/**
 * Activity launch control across a child's classes: hidden only when every
 * class hides it; the pinned activity is the latest launch they can see.
 */

const row = (classId: string, slug: string, hidden: boolean, launchedAt: string | null = null): ClassActivitySetting => ({
  classId,
  slug,
  hidden,
  launchedAt: launchedAt ? new Date(launchedAt) : null,
});

describe("settingsForChild", () => {
  it("a child in no class sees everything, with nothing launched", () => {
    const s = settingsForChild([], [row("a", "fortune-teller", true, "2026-09-30T08:00:00Z")]);
    expect([...s.hidden]).toEqual([]);
    expect(s.launched).toBeNull();
  });

  it("hides an activity only when every one of the child's classes hides it", () => {
    const settings = [row("a", "fortune-teller", true), row("b", "fortune-teller", false), row("a", "who-decides", true), row("b", "who-decides", true)];
    expect([...settingsForChild(["a", "b"], settings).hidden]).toEqual(["who-decides"]);
    expect([...settingsForChild(["a"], settings).hidden].sort()).toEqual(["fortune-teller", "who-decides"]);
  });

  it("a class with no row for an activity keeps it open", () => {
    expect([...settingsForChild(["a", "b"], [row("a", "bias-detective", true)]).hidden]).toEqual([]);
  });

  it("pins the most recent launch from the child's own classes", () => {
    const settings = [
      row("a", "train-a-sorter", false, "2026-09-30T08:00:00Z"),
      row("b", "is-that-real", false, "2026-09-30T09:00:00Z"),
      row("c", "who-decides", false, "2026-09-30T10:00:00Z"),
    ];
    expect(settingsForChild(["a", "b"], settings).launched?.slug).toBe("is-that-real");
    expect(settingsForChild(["a"], settings).launched?.slug).toBe("train-a-sorter");
  });

  it("never pins an activity the child can't see", () => {
    const settings = [row("a", "fortune-teller", true, "2026-09-30T08:00:00Z")];
    expect(settingsForChild(["a"], settings).launched).toBeNull();
  });
});
