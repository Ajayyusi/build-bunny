import { describe, expect, it } from "vitest";

import { getActivityEngine } from "@/modules/activities/server/registry";
import { aiClassificationPayload } from "@/modules/curriculum/schemas";
import type { LevelSnapshot } from "@/modules/curriculum/server/publish";

import { bundle } from "../../content";

const level = bundle.worlds.flatMap((w) => w.modules.flatMap((m) => m.levels)).find((l) => l.slug === "the-berry-that-lied")!;
const payload = aiClassificationPayload.parse(level.payload);
const snapshot = { activityType: "AI_CLASSIFICATION", payload: level.payload } as unknown as LevelSnapshot;
const engine = getActivityEngine("AI_CLASSIFICATION")!;
const grade = (examples: { id: string; label: "positive" | "negative" }[]) => {
  const answer = {
    examples: examples.map((e) => {
      const s = payload.pool.find((p) => p.id === e.id)!;
      return { id: s.id, size: s.size, color: s.color, label: e.label };
    }),
  };
  return engine.grade(snapshot, answer).verdict;
};

describe("The Berry That Lied: repair the data", () => {
  it("ships with note-fixing on", () => {
    expect(payload.relabel).toBe(true);
  });

  it("teaching every note as written fails; fixing the lying note passes, like taking it out", () => {
    const asWritten = payload.pool.map((s) => ({ id: s.id, label: s.truth }));
    expect(grade(asWritten)).not.toBe("PASS");
    // The one note that contradicts the rule (colour above the threshold, noted safe).
    const liar = payload.pool.find((s) => s.truth === "positive" && s.color > 0.5)!;
    const fixed = asWritten.map((e) => (e.id === liar.id ? { ...e, label: "negative" as const } : e));
    expect(grade(fixed)).toBe("PASS");
    expect(grade(asWritten.filter((e) => e.id !== liar.id))).toBe("PASS");
  });
});
