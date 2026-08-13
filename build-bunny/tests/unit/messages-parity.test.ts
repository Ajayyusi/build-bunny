import {
  isArgumentElement,
  isDateElement,
  isNumberElement,
  isPluralElement,
  isSelectElement,
  isTagElement,
  isTimeElement,
  parse,
  type MessageFormatElement,
} from "@formatjs/icu-messageformat-parser";
import { describe, expect, it } from "vitest";
import ar from "../../messages/ar.json";
import en from "../../messages/en.json";

/**
 * UI message-catalog parity gate. Curriculum content already has an Arabic
 * parity gate (content-fixtures.test.ts); this is the equivalent for
 * messages/en.json + ar.json, which previously relied on convention alone.
 * next-intl throws at runtime on a missing key, so a parity miss here is a
 * white screen for one locale — fail it in CI instead.
 */

type Messages = { [key: string]: string | Messages };

function flatten(obj: Messages, prefix = "", out: Record<string, string> = {}) {
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "object" && value !== null) {
      flatten(value, path, out);
    } else {
      out[path] = value;
    }
  }
  return out;
}

// Keys whose en/ar values are deliberately identical: brand literals, each
// language's own name, and placeholder/punctuation-only strings. Adding a key
// here is a conscious decision that the string must not differ by locale —
// never a shortcut for an untranslated string.
const DELIBERATELY_IDENTICAL = new Set([
  "common.appName",
  "common.english",
  "common.arabic",
  "student.header.xpChip",
  "staff.teach.replay.meta",
  "staff.school.analytics.licenceSeatsValue",
  "staff.school.studentsPage.noClass",
  "platform.curriculum.levels.order",
  "platform.users.noSchool",
  "certificates.sheet.brand",
]);

// ICU argument names via the real parser (transitive dep of next-intl), so
// plural-branch literal text ("one {One point is}") is never misread as an
// argument. Tag names (<b>…</b>) count too: both locales must supply the
// same rich-text handlers.
function collectArgs(elements: MessageFormatElement[], out: Set<string>) {
  for (const el of elements) {
    if (isArgumentElement(el) || isNumberElement(el) || isDateElement(el) || isTimeElement(el)) {
      out.add(el.value);
    } else if (isPluralElement(el) || isSelectElement(el)) {
      out.add(el.value);
      for (const option of Object.values(el.options)) {
        collectArgs(option.value, out);
      }
    } else if (isTagElement(el)) {
      out.add(el.value);
      collectArgs(el.children, out);
    }
  }
}

function icuArgs(key: string, message: string): string[] {
  const out = new Set<string>();
  try {
    collectArgs(parse(message), out);
  } catch (error) {
    throw new Error(`Message "${key}" is not valid ICU: ${String(error)}`);
  }
  return [...out].sort();
}

const flatEn = flatten(en as Messages);
const flatAr = flatten(ar as Messages);

describe("messages/en.json vs messages/ar.json", () => {
  it("has identical key sets", () => {
    const enKeys = Object.keys(flatEn);
    const arKeys = new Set(Object.keys(flatAr));
    const missingInAr = enKeys.filter((k) => !arKeys.has(k));
    const extraInAr = Object.keys(flatAr).filter((k) => !(k in flatEn));
    expect(missingInAr).toEqual([]);
    expect(extraInAr).toEqual([]);
  });

  it("has no empty values in either locale", () => {
    const emptyEn = Object.entries(flatEn).filter(([, v]) => v.trim() === "");
    const emptyAr = Object.entries(flatAr).filter(([, v]) => v.trim() === "");
    expect(emptyEn).toEqual([]);
    expect(emptyAr).toEqual([]);
  });

  it("keeps identical en/ar values on the explicit allowlist only", () => {
    const identical = Object.keys(flatEn)
      .filter((k) => k in flatAr && flatEn[k] === flatAr[k])
      .filter((k) => !DELIBERATELY_IDENTICAL.has(k));
    // A hit here usually means an untranslated Arabic string. If the value is
    // genuinely locale-invariant, add the key to DELIBERATELY_IDENTICAL.
    expect(identical).toEqual([]);
  });

  it("has no stale allowlist entries", () => {
    const stale = [...DELIBERATELY_IDENTICAL].filter(
      (k) => !(k in flatEn) || flatEn[k] !== flatAr[k],
    );
    expect(stale).toEqual([]);
  });

  it("uses the same ICU placeholder names in both locales", () => {
    const mismatches = Object.entries(flatEn)
      .filter(([k]) => k in flatAr)
      .map(([k, enValue]) => ({
        key: k,
        en: icuArgs(k, enValue),
        ar: icuArgs(k, flatAr[k] ?? ""),
      }))
      .filter((m) => m.en.join(",") !== m.ar.join(","));
    expect(mismatches).toEqual([]);
  });
});
