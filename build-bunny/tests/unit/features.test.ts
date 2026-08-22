import { describe, expect, it } from "vitest";

import {
  applyFeatureFlag,
  FEATURE_FLAGS,
  isFeatureEnabled,
  isKnownFeatureFlag,
} from "@/modules/shared/features";

/**
 * Flags decide whether a whole student surface exists, and the column they
 * live in is operator-editable, so the reader is treated as parsing hostile
 * input and the writer must never clobber a flag it was not asked about.
 */

describe("isFeatureEnabled", () => {
  it("is on only for an exact boolean true", () => {
    expect(isFeatureEnabled({ adventure: true }, "adventure")).toBe(true);
  });

  it.each([
    ["a truthy string", { adventure: "true" }],
    ["a truthy number", { adventure: 1 }],
    ["an explicit false", { adventure: false }],
    ["a missing key", {}],
    ["null", null],
    ["an array", ["adventure"]],
    ["a string column", "adventure"],
    ["undefined", undefined],
  ])("reads OFF for %s", (_label, features) => {
    expect(isFeatureEnabled(features, "adventure")).toBe(false);
  });
});

describe("applyFeatureFlag", () => {
  it("sets the requested flag", () => {
    expect(applyFeatureFlag({}, "adventure", true)).toEqual({ adventure: true });
  });

  it("preserves flags it was not asked about", () => {
    // The whole point: flags share one JSON column, so writing one wholesale
    // would silently switch every other surface off.
    expect(applyFeatureFlag({ aiLab: true }, "adventure", true)).toEqual({
      aiLab: true,
      adventure: true,
    });
  });

  it("keeps keys this build does not know about", () => {
    // A flag an operator set by hand for a newer build is not ours to drop.
    expect(applyFeatureFlag({ somethingNewer: true }, "adventure", false)).toEqual({
      somethingNewer: true,
      adventure: false,
    });
  });

  it("recovers from a corrupt column rather than throwing", () => {
    expect(applyFeatureFlag("not-an-object", "adventure", true)).toEqual({ adventure: true });
    expect(applyFeatureFlag(null, "adventure", true)).toEqual({ adventure: true });
    expect(applyFeatureFlag(["adventure"], "adventure", true)).toEqual({ adventure: true });
  });

  it("does not mutate the stored value it was given", () => {
    const stored = { aiLab: true };
    applyFeatureFlag(stored, "adventure", true);
    expect(stored).toEqual({ aiLab: true });
  });

  it("round-trips with the reader", () => {
    const off = applyFeatureFlag({ adventure: true }, "adventure", false);
    expect(isFeatureEnabled(off, "adventure")).toBe(false);
    const on = applyFeatureFlag(off, "adventure", true);
    expect(isFeatureEnabled(on, "adventure")).toBe(true);
  });
});

describe("the flag registry", () => {
  it("only lists flags the app actually reads", () => {
    // A registry entry becomes a switch in the admin console. Listing a flag
    // that gates nothing ships an operator a control that does nothing.
    expect(FEATURE_FLAGS.map((flag) => flag.key)).toEqual(["adventure", "leaderboard"]);
  });

  it("recognises registry keys and rejects anything else", () => {
    expect(isKnownFeatureFlag("adventure")).toBe(true);
    expect(isKnownFeatureFlag("aiLab")).toBe(false);
    expect(isKnownFeatureFlag("__proto__")).toBe(false);
  });
});
