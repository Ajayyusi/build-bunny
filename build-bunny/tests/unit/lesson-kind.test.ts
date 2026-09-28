import { describe, expect, it } from "vitest";

import { CITIZENSHIP_SLUGS, EXPLORE_OPEN_SLUGS, lessonKindOf } from "@/modules/explore/catalog";

import { bundle } from "../../content";

const levels = bundle.worlds.flatMap((w) => w.modules.flatMap((m) => m.levels));

describe("citizenship missions vs AI lessons", () => {
  it("labels the online-safety stories as digital citizenship, and the rest of AI as AI lessons", () => {
    expect(lessonKindOf({ slug: "kind-online", activityType: "AI_ETHICS" })).toBe("citizenship");
    expect(lessonKindOf({ slug: "is-that-real", activityType: "AI_ETHICS" })).toBe("ai");
    expect(lessonKindOf({ slug: "who-decides", activityType: "AI_ETHICS" })).toBe("ai");
    expect(lessonKindOf({ slug: "train-a-sorter", activityType: "AI_CLASSIFICATION" })).toBe("ai");
    expect(lessonKindOf({ slug: "first-hop", activityType: "BLOCK_CODING" })).toBe("coding");
  });

  it("every citizenship slug is a real ethics level", () => {
    for (const slug of CITIZENSHIP_SLUGS) {
      expect(levels.find((l) => l.slug === slug)?.activityType, slug).toBe("AI_ETHICS");
    }
  });

  it("opens The Berry That Lied from day one, with the six cards", () => {
    expect(EXPLORE_OPEN_SLUGS.has("the-berry-that-lied")).toBe(true);
    for (const slug of EXPLORE_OPEN_SLUGS) expect(levels.some((l) => l.slug === slug), slug).toBe(true);
  });
});
