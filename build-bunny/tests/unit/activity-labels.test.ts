import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import ar from "../../messages/ar.json";
import en from "../../messages/en.json";

/**
 * Every ActivityType has a human label in the curriculum console.
 *
 * Eight of the twelve enum values had none, so 20 of the 37 seeded levels
 * showed a raw `PATTERN_RECOGNITION` in the console's Activity column. The
 * page guards the lookup, so nothing threw — it just quietly displayed a
 * database identifier to a human and looked like an unfinished screen.
 *
 * Read from schema.prisma rather than a hand-copied list: the point is to
 * fail when someone ADDS an enum value, which is exactly the moment a
 * duplicated list in a test file would silently agree with itself.
 */

const SCHEMA = readFileSync(join(__dirname, "..", "..", "prisma", "schema.prisma"), "utf8");

function activityTypes(): string[] {
  const block = /enum ActivityType \{([^}]*)\}/.exec(SCHEMA);
  if (!block) throw new Error("ActivityType enum not found in schema.prisma");
  return block[1]!
    .split("\n")
    .map((line) => line.replace(/\/\/.*$/, "").trim())
    .filter((line) => /^[A-Z_]+$/.test(line));
}

describe("activity type labels", () => {
  const types = activityTypes();

  it("reads the enum from the schema", () => {
    // Guards the parser: a schema reformat that broke the regex would make
    // every assertion below vacuously pass.
    expect(types.length).toBeGreaterThanOrEqual(12);
    expect(types).toContain("BLOCK_CODING");
    expect(types).toContain("CONCEPT_CARDS");
  });

  it("labels every activity type in both locales", () => {
    const enLabels = en.platform.curriculum.activity as Record<string, string>;
    const arLabels = ar.platform.curriculum.activity as Record<string, string>;

    const missingEn = types.filter((type) => !enLabels[type]);
    const missingAr = types.filter((type) => !arLabels[type]);

    expect({ missingEn, missingAr }).toEqual({ missingEn: [], missingAr: [] });
  });

  it("has no label for a type the enum does not contain", () => {
    // The reverse drift: a renamed enum value leaves a label that can never
    // render, and the console silently falls back to the raw name again.
    const enLabels = Object.keys(en.platform.curriculum.activity);
    expect(enLabels.filter((key) => !types.includes(key))).toEqual([]);
  });
});
