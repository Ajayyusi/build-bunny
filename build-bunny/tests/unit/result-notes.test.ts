import { describe, expect, it } from "vitest";

import { ethicsResultNotes, pixelResultNotes, trendResultNotes } from "@/modules/activities/players/result-notes";
import { aiEthicsPayload } from "@/modules/curriculum/schemas";

import { bundle } from "../../content";

describe("result notes: what you tried, what changed, one more to test", () => {
  it("See Like a Computer names the rounds that needed more squares or fooled the child", () => {
    const right = { status: "right", squares: 8, step: 0 };
    const clearer = { status: "right", squares: 16, step: 1 };
    const missed = { status: "missed", squares: 8, step: 0 };
    expect(pixelResultNotes([right, right, right], 8, "and").changed).toEqual({ key: "pixel.changedNone", values: { squares: 8 } });
    expect(pixelResultNotes([clearer, right, clearer], 8, "and").changed).toEqual({
      key: "pixel.changedMore",
      values: { rounds: "1 and 3", count: 2 },
    });
    // A miss is the bigger story.
    expect(pixelResultNotes([clearer, missed, right], 8, "and").changed).toMatchObject({ key: "pixel.changedMissed", values: { rounds: "2" } });
    expect(pixelResultNotes([right, right, right], 8, "and").tried).toEqual({ key: "pixel.tried", values: { count: 3 } });
  });

  it("Fortune Teller compares the child's line and guess with the computer's", () => {
    const points = [1, 2, 3, 4, 5].map((x) => ({ x, y: 2 * x }));
    const exact = trendResultNotes({ points, predictAt: 7, line: { slope: 2, intercept: 0 }, prediction: 14, failedChecks: 0 });
    expect(exact.tried).toEqual({ key: "trend.triedInside", values: { miss: 0, best: 0, guess: 14, x: 7 } });
    expect(exact.changed).toEqual({ key: "trend.changedFirst" });
    // 7 is 2 past the data, so "one more" asks about 2 further.
    expect(exact.tryNext).toEqual({ key: "trend.tryNext", values: { further: 9, x: 7 } });
    const later = trendResultNotes({ points, predictAt: 7, line: { slope: 2, intercept: 1 }, prediction: 30, failedChecks: 2 });
    expect(later.tried).toMatchObject({ key: "trend.triedOutside", values: { miss: 5 } });
    expect(later.changed).toEqual({ key: "trend.changedChecks", values: { checks: 3 } });
  });

  it("ethics counts other choices looked at and changes of mind, not going back", () => {
    const notes = ethicsResultNotes(
      [
        { choiceId: "b", tried: ["a"] }, // changed mind
        { choiceId: "c", tried: ["c", "d"] }, // went back to the first
        { choiceId: "e" },
      ],
      "Check the source.",
    );
    expect(notes.tried).toEqual({ key: "ethics.tried", values: { choices: 3, others: 2 } });
    expect(notes.changed).toEqual({ key: "ethics.changed", values: { count: 1 } });
    expect(notes.tryNext).toEqual({ text: "Check the source." });
    expect(ethicsResultNotes([{ choiceId: "a" }], null).changed).toEqual({ key: "ethics.changedNone" });
  });

  it("every ethics level authors its own real-life case to try next", () => {
    const ethics = bundle.worlds.flatMap((w) => w.modules.flatMap((m) => m.levels)).filter((l) => l.activityType === "AI_ETHICS");
    for (const l of ethics) {
      const p = aiEthicsPayload.parse(l.payload);
      expect(p.tryNext?.en && p.tryNext.ar, l.slug).toBeTruthy();
    }
  });
});
