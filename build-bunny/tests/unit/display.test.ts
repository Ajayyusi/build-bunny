import { describe, expect, it } from "vitest";

import {
  DEFAULT_DISPLAY_PREFS,
  DISPLAY_BOOT_SCRIPT,
  DISPLAY_STORAGE_KEY,
  displayAttributes,
  parseDisplayPrefs,
  type DisplayPrefs,
} from "@/ui/display/prefs";

describe("display preferences", () => {
  it("defaults to the normal look, which sets no attributes at all", () => {
    expect(parseDisplayPrefs(null)).toEqual(DEFAULT_DISPLAY_PREFS);
    expect(displayAttributes(DEFAULT_DISPLAY_PREFS)).toEqual({});
  });

  it("ignores corrupt or unknown values field by field", () => {
    expect(parseDisplayPrefs("{oops")).toEqual(DEFAULT_DISPLAY_PREFS);
    const odd = parseDisplayPrefs(
      JSON.stringify({ textSize: "huge", contrast: "high", motion: 7 }),
    );
    expect(odd).toEqual({ ...DEFAULT_DISPLAY_PREFS, contrast: "high" });
  });

  it("round-trips every setting", () => {
    const prefs: DisplayPrefs = { version: 1, textSize: "xl", contrast: "high", motion: "reduce" };
    expect(parseDisplayPrefs(JSON.stringify(prefs))).toEqual(prefs);
    expect(displayAttributes(prefs)).toEqual({
      "data-text-size": "xl",
      "data-contrast": "high",
      "data-motion": "reduce",
    });
  });

  it("boot script applies exactly what displayAttributes would, before hydration", () => {
    // Run the inline script against a stub document/localStorage.
    const run = (stored: string | null) => {
      const set: Record<string, string> = {};
      const fn = new Function(
        "localStorage",
        "document",
        DISPLAY_BOOT_SCRIPT,
      ) as (ls: unknown, doc: unknown) => void;
      fn(
        { getItem: (k: string) => (k === DISPLAY_STORAGE_KEY ? stored : null) },
        { documentElement: { setAttribute: (k: string, v: string) => (set[k] = v) } },
      );
      return set;
    };
    const cases: DisplayPrefs[] = [
      DEFAULT_DISPLAY_PREFS,
      { version: 1, textSize: "large", contrast: "normal", motion: "auto" },
      { version: 1, textSize: "xl", contrast: "high", motion: "reduce" },
    ];
    for (const prefs of cases) {
      expect(run(JSON.stringify(prefs))).toEqual(displayAttributes(prefs));
    }
    expect(run("not json")).toEqual({});
    expect(run(null)).toEqual({});
  });
});
