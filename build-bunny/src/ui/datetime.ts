/**
 * Date and time formatting for display, in one place.
 *
 * Two rules the product cares about, both easy to get wrong per-page and
 * both invisible until an Arabic-speaking user looks at the screen:
 *
 *  1. **Western digits everywhere** (`-u-nu-latn`). The content glossary
 *     pins this: a teacher reading an Arabic console still expects to see
 *     23/07/2026, not ٢٣/٠٧/٢٠٢٦, because dates and counts are compared
 *     against registers, invoices and timetables written in Western digits.
 *
 *  2. **No embedded bidi marks.** CLDR's Arabic date patterns include
 *     RIGHT-TO-LEFT MARKs between the parts. Those are strong directional
 *     characters, so they survive a `dir="ltr"` wrapper and reorder the
 *     segments — a date rendered as the unreadable "232026/07/" instead of
 *     "23/07/2026". Stripping them and keeping the LTR wrapper is what
 *     actually renders correctly in both locales.
 *
 * Shaped as a drop-in for `new Intl.DateTimeFormat(...)`: it returns
 * something with `.format()`, so call sites read the same as before.
 *
 * NOT for machine-readable dates. Date KEYS (streak day boundaries, CSV
 * columns, anything compared or stored) must keep using their own explicit
 * format — see grading/server/streak.ts, which pins en-CA on purpose.
 */

/** LRM, RLM, and the Arabic letter mark. */
const BIDI_MARKS = /[‎‏؜]/g;

export interface DisplayDateFormat {
  format(value: Date | number): string;
}

export function createDateFormat(
  locale: string,
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium" },
): DisplayDateFormat {
  const inner = new Intl.DateTimeFormat(`${locale}-u-nu-latn`, options);
  return {
    format: (value: Date | number) => inner.format(value).replace(BIDI_MARKS, ""),
  };
}

/** One-off convenience for a single date; prefer createDateFormat in lists. */
export function formatDisplayDate(
  value: Date | number,
  locale: string,
  options?: Intl.DateTimeFormatOptions,
): string {
  return createDateFormat(locale, options).format(value);
}
