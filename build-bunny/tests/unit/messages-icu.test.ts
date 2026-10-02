import { IntlMessageFormat } from "intl-messageformat";
import { describe, expect, it } from "vitest";

import en from "../../messages/en.json";
import ar from "../../messages/ar.json";

/**
 * Every message compiles as ICU in its own locale, so a broken plural or
 * select block (a missing brace, an unknown category) fails here rather
 * than as raw text on a child's screen. Arabic uses all six plural
 * categories; English two.
 */
const flat = (node: unknown, path = "", out: Record<string, string> = {}) => {
  if (typeof node === "string") out[path] = node;
  else if (node && typeof node === "object") for (const [k, v] of Object.entries(node)) flat(v, path ? `${path}.${k}` : k, out);
  return out;
};

describe.each([
  ["en", en],
  ["ar", ar],
] as const)("%s messages", (locale, messages) => {
  it("all compile as ICU message format", () => {
    const broken: string[] = [];
    for (const [key, value] of Object.entries(flat(messages))) {
      try {
        new IntlMessageFormat(value, locale, undefined, { ignoreTag: true });
      } catch (error) {
        broken.push(`${key}: ${(error as Error).message}`);
      }
    }
    expect(broken).toEqual([]);
  });
});
