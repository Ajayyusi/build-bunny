import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { CSTA_CODES, standardsForTags, TAG_STANDARDS } from "@/modules/curriculum/standards";

/** Every tag written in the content sources, read straight from the files. */
function contentTags(): Set<string> {
  const tags = new Set<string>();
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".ts")) {
        for (const match of readFileSync(full, "utf8").matchAll(/tags: \[([^\]]*)\]/g)) {
          for (const tag of match[1]!.matchAll(/"([a-z-]+)"/g)) tags.add(tag[1]!);
        }
      }
    }
  };
  walk(path.resolve(__dirname, "../../content"));
  return tags;
}

describe("CSTA suggested alignment", () => {
  it("maps only to codes in the catalogue, which are well-formed", () => {
    for (const code of CSTA_CODES) expect(code).toMatch(/^(1B|2)-(AP|CS|DA|IC|NI)-\d{2}$/);
    for (const codes of Object.values(TAG_STANDARDS)) {
      for (const code of codes) expect(CSTA_CODES).toContain(code);
    }
  });

  it("covers every concept tag the curriculum uses, except the worked-example marker", () => {
    const unmapped = [...contentTags()].filter((tag) => tag !== "learn" && !(tag in TAG_STANDARDS));
    expect(unmapped).toEqual([]);
  });

  it("merges tags into distinct codes in catalogue order", () => {
    expect(standardsForTags(["loops", "sequencing", "debugging"])).toEqual([
      "1B-AP-10",
      "1B-AP-15",
      "2-AP-12",
      "2-AP-17",
    ]);
    expect(standardsForTags(["learn"])).toEqual([]);
  });
});

describe("concept labels in the curriculum guide", () => {
  it("every content tag has a readable label in English and Arabic", () => {
    const labels = (locale: string) =>
      (JSON.parse(readFileSync(path.resolve(__dirname, `../../messages/${locale}.json`), "utf8")) as {
        staff: { teach: { curriculum: { tagLabel: Record<string, string> } } };
      }).staff.teach.curriculum.tagLabel;
    const en = labels("en");
    const ar = labels("ar");
    const missing = [...contentTags()].filter((tag) => !en[tag] || !ar[tag]);
    expect(missing).toEqual([]);
  });
});
