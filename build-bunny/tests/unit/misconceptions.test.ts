import { describe, expect, it } from "vitest";

import {
  FEEDBACK_MISCONCEPTION,
  MISCONCEPTION_IDS,
  misconceptionOf,
  summarizeMisconceptions,
  type MisconceptionAttemptRow,
} from "@/modules/analytics/misconceptions";

/**
 * Misconception reports group a class's located feedback codes into ideas
 * a teacher can reteach. What is pinned: which runs count, how they group,
 * and that every mapped idea has a place in the catalogue.
 */

const row = (
  studentUserId: string,
  levelId: string,
  verdict: MisconceptionAttemptRow["verdict"],
  feedbackCode: string | null,
  qualityPassed: boolean | null = verdict === "PASS",
): MisconceptionAttemptRow => ({ studentUserId, levelId, verdict, qualityPassed, feedbackCode });

describe("misconceptionOf", () => {
  it("maps located failure codes to ideas, and ignores what is not a misconception", () => {
    expect(misconceptionOf(row("s1", "l1", "FAIL", "bumped"))).toBe("turnDirection");
    expect(misconceptionOf(row("s1", "l1", "PARTIAL", "carrotsLeft"))).toBe("missedStop");
    expect(misconceptionOf(row("s1", "l1", "FAIL", "wrongVariable"))).toBe("counterTrace");
    // A clean pass is not a misconception, even with a code attached.
    expect(misconceptionOf(row("s1", "l1", "PASS", "tooManyBlocks", true))).toBeNull();
    // A pass that only missed the block budget is: a loop was left unused.
    expect(misconceptionOf(row("s1", "l1", "PASS", "tooManyBlocks", false))).toBe("repeatNotUsed");
    // Infrastructure and unknown codes never count.
    expect(misconceptionOf(row("s1", "l1", "ERROR", "runtimeError"))).toBeNull();
    expect(misconceptionOf(row("s1", "l1", "FAIL", "runtimeError"))).toBeNull();
    expect(misconceptionOf(row("s1", "l1", "FAIL", null))).toBeNull();
  });

  it("every mapped code lands on a catalogued idea", () => {
    for (const id of Object.values(FEEDBACK_MISCONCEPTION)) {
      expect(MISCONCEPTION_IDS).toContain(id);
    }
  });
});

describe("summarizeMisconceptions", () => {
  const rows: MisconceptionAttemptRow[] = [
    row("a", "turn-around", "FAIL", "bumped"),
    row("a", "turn-around", "FAIL", "bumped"),
    row("b", "turn-around", "FAIL", "bumped"),
    row("c", "market-run", "FAIL", "bumped"),
    row("a", "count-the-hops", "FAIL", "wrongVariable"),
    row("b", "count-the-hops", "PARTIAL", "wrongOutput"),
    row("b", "count-the-hops", "PARTIAL", "wrongOutput"),
    row("c", "repeat-after-me", "PASS", "tooManyBlocks", false),
    row("d", "repeat-after-me", "PASS", null, true),
    row("d", "first-hop", "FAIL", "notOnGoal"), // a single run: below the bar
  ];

  it("groups by idea, counts runs and distinct children, and names the levels it shows on", () => {
    const summary = summarizeMisconceptions(rows);
    expect(summary.map((s) => s.id)).toEqual(["turnDirection", "sayPlacement"]);
    expect(summary[0]).toEqual({
      id: "turnDirection",
      attempts: 4,
      students: 3,
      levels: [
        { levelId: "turn-around", attempts: 3 },
        { levelId: "market-run", attempts: 1 },
      ],
    });
    expect(summary[1]).toMatchObject({ id: "sayPlacement", attempts: 2, students: 1 });
  });

  it("honours the attempt floor and the limit", () => {
    const all = summarizeMisconceptions(rows, { minAttempts: 1 });
    expect(all.map((s) => s.id)).toEqual([
      "turnDirection",
      "sayPlacement",
      "counterTrace",
      "countingHops",
      "repeatNotUsed",
    ]);
    expect(summarizeMisconceptions(rows, { minAttempts: 1, limit: 2 })).toHaveLength(2);
    expect(summarizeMisconceptions([])).toEqual([]);
  });
});
