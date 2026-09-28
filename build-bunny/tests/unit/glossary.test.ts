import { describe, expect, it } from "vitest";

import { GLOSSARY_TERMS, termsForTags, TERMS_BY_TAG } from "@/modules/explore/glossary";

import en from "../../messages/en.json";
import ar from "../../messages/ar.json";
import { bundle } from "../../content";

const levels = bundle.worlds.flatMap((w) => w.modules.flatMap((m) => m.levels));

describe("What is this called?", () => {
  it("every AI level has the proper names for its idea", () => {
    for (const l of levels.filter((x) => x.track !== "PROGRAMMING")) {
      expect(termsForTags(l.tags ?? []).length, l.slug).toBeGreaterThan(0);
    }
  });

  it("names each term once, in the order its tags bring them", () => {
    expect(termsForTags(["classification", "boundary", "classification"])).toEqual([
      "machineLearning",
      "trainingData",
      "label",
      "classifier",
      "nearestNeighbour",
      "decisionBoundary",
    ]);
    expect(termsForTags(["loops", "logic"])).toEqual([]);
  });

  it("every term has a name and one plain sentence in both languages", () => {
    const g = { en: en.student.glossary as unknown as Record<string, { name: string; plain: string }>, ar: ar.student.glossary as unknown as Record<string, { name: string; plain: string }> };
    for (const term of GLOSSARY_TERMS) {
      for (const lang of ["en", "ar"] as const) {
        expect(g[lang][term]?.name, `${lang} ${term}`).toBeTruthy();
        expect(g[lang][term]?.plain, `${lang} ${term}`).toBeTruthy();
      }
    }
    // Every term a tag brings is in the catalog, and every catalog term is used.
    const used = new Set(Object.values(TERMS_BY_TAG).flat());
    expect([...used].every((t) => (GLOSSARY_TERMS as readonly string[]).includes(t))).toBe(true);
    expect(GLOSSARY_TERMS.filter((t) => !used.has(t))).toEqual([]);
  });

  it("technical labels stay off the first screen of See Like a Computer", () => {
    const pp = en.student.play.aiSim.pixelPlayground;
    expect(`${pp.kernelHeading} ${pp.kernelCell}`).not.toMatch(/kernel/i);
  });
});
