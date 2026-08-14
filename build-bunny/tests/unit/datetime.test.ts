import { describe, expect, it } from "vitest";

import { createDateFormat, formatDisplayDate } from "@/ui/datetime";

/**
 * Both rules this formatter exists for are invisible in English and only
 * show up when an Arabic-speaking user looks at the screen, which is exactly
 * why they need a test rather than a convention.
 */

const WHEN = new Date("2026-07-23T09:05:00Z");
/** LRM, RLM, ALM — the characters CLDR embeds in Arabic date patterns. */
const BIDI = /[‎‏؜]/;

describe("createDateFormat", () => {
  it("uses Western digits in Arabic", () => {
    const formatted = createDateFormat("ar", { dateStyle: "short" }).format(WHEN);
    // Arabic-Indic digits would violate the glossary's numeral policy.
    expect(formatted).not.toMatch(/[٠-٩]/);
    expect(formatted).toMatch(/\d/);
    expect(formatted).toContain("2026");
  });

  it("emits no bidi control characters in either locale", () => {
    // These survive a dir="ltr" wrapper and reorder the segments, which is
    // how a date rendered as the unreadable "232026/07/".
    expect(createDateFormat("ar", { dateStyle: "short" }).format(WHEN)).not.toMatch(BIDI);
    expect(createDateFormat("en", { dateStyle: "short" }).format(WHEN)).not.toMatch(BIDI);
  });

  it("keeps the date parts in reading order for Arabic", () => {
    const formatted = createDateFormat("ar", { dateStyle: "short" }).format(WHEN);
    const numbers = formatted.match(/\d+/g) ?? [];
    // Day, month, year — the year must not end up wedged against the day,
    // which is what the scrambled render looked like.
    expect(numbers.at(-1)).toBe("2026");
  });

  it("still localises the words, not just the digits", () => {
    const arabic = createDateFormat("ar", { dateStyle: "long" }).format(WHEN);
    // Western digits are a numeral policy, not an English-only policy.
    expect(arabic).toMatch(/[؀-ۿ]/);
  });

  it("defaults to a medium date", () => {
    expect(createDateFormat("en").format(WHEN)).toBe(
      new Intl.DateTimeFormat("en-u-nu-latn", { dateStyle: "medium" }).format(WHEN),
    );
  });

  it("formats time as well when asked", () => {
    const formatted = createDateFormat("en", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(WHEN);
    expect(formatted).toMatch(/\d{1,2}:\d{2}/);
  });

  it("accepts a timestamp as well as a Date", () => {
    const format = createDateFormat("en", { dateStyle: "short" });
    expect(format.format(WHEN.getTime())).toBe(format.format(WHEN));
  });
});

describe("formatDisplayDate", () => {
  it("matches the reusable formatter", () => {
    expect(formatDisplayDate(WHEN, "ar", { dateStyle: "long" })).toBe(
      createDateFormat("ar", { dateStyle: "long" }).format(WHEN),
    );
  });
});
