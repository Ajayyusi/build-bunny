import { describe, expect, it } from "vitest";

import { restoreLine, restoreRounds } from "@/modules/ai/lab/players/restore-work";

/**
 * Autosaved widget work is the child's own, but it still arrives from a past
 * session: it may be stale, hand-edited in devtools, or written against an
 * older version of the level. Every one of these cases must degrade to the
 * widget's normal starting state rather than break the level on load, which
 * is the difference between "your work is back" and "the game is broken".
 */

describe("restoreLine", () => {
  it("restores a saved line", () => {
    expect(restoreLine({ line: { slope: 1.5, intercept: -3 } })).toEqual({
      slope: 1.5,
      intercept: -3,
    });
  });

  it("rejects anything that is not a line", () => {
    for (const bad of [null, undefined, 42, "line", [], {}, { line: null }, { line: 7 }]) {
      expect(restoreLine(bad)).toBeNull();
    }
  });

  it("rejects a partially-shaped line", () => {
    expect(restoreLine({ line: { slope: 1 } })).toBeNull();
    expect(restoreLine({ line: { intercept: 1 } })).toBeNull();
    expect(restoreLine({ line: { slope: "1", intercept: 2 } })).toBeNull();
  });

  it("rejects non-finite numbers, which would render an invisible chart", () => {
    expect(restoreLine({ line: { slope: NaN, intercept: 0 } })).toBeNull();
    expect(restoreLine({ line: { slope: 0, intercept: Infinity } })).toBeNull();
    expect(restoreLine({ line: { slope: -Infinity, intercept: 0 } })).toBeNull();
  });

  it("accepts a genuinely flat line rather than treating 0 as missing", () => {
    expect(restoreLine({ line: { slope: 0, intercept: 0 } })).toEqual({
      slope: 0,
      intercept: 0,
    });
  });
});

describe("restoreRounds", () => {
  const ROUNDS = ["r1", "r2"] as const;
  const IMAGES = ["a", "b"] as const;

  it("restores answers for rounds and images the level still has", () => {
    expect(restoreRounds({ rounds: { r1: "a", r2: "b" } }, ROUNDS, IMAGES)).toEqual({
      r1: "a",
      r2: "b",
    });
  });

  it("drops a round the level no longer contains", () => {
    // The level was edited after the draft was written.
    expect(restoreRounds({ rounds: { r1: "a", gone: "b" } }, ROUNDS, IMAGES)).toEqual({
      r1: "a",
    });
  });

  it("drops an answer naming an image the level no longer contains", () => {
    expect(restoreRounds({ rounds: { r1: "removed" } }, ROUNDS, IMAGES)).toEqual({});
  });

  it("returns an empty board for malformed input", () => {
    for (const bad of [null, undefined, 1, "x", [], {}, { rounds: null }, { rounds: 5 }]) {
      expect(restoreRounds(bad, ROUNDS, IMAGES)).toEqual({});
    }
  });

  it("ignores non-string answers", () => {
    expect(restoreRounds({ rounds: { r1: 3, r2: "b" } }, ROUNDS, IMAGES)).toEqual({ r2: "b" });
  });

  it("does not inherit prototype keys", () => {
    // A hand-edited draft must not be able to smuggle in a round id.
    const hostile = JSON.parse('{"rounds": {"__proto__": {"r1": "a"}}}') as unknown;
    expect(restoreRounds(hostile, ROUNDS, IMAGES)).toEqual({});
  });
});
