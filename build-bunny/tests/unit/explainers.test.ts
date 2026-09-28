import { describe, expect, it } from "vitest";

import { CHARACTER_IDS } from "@/modules/characters/cast";
import { CHARACTER_STATES } from "@/modules/characters/states";
import { beatIndexAt, EXPLAINER_FOR_LEVEL, EXPLAINERS } from "@/modules/explainers/scripts";

import en from "../../messages/en.json";
import ar from "../../messages/ar.json";
import { bundle } from "../../content";

/**
 * Explainers against the handoff: 20-40 seconds, one idea shown through a
 * concrete mistake, ending on an interactive choice; captions for every
 * beat in both languages; offered on a real level, never required.
 */

const at = (messages: unknown, path: string) =>
  path.split(".").reduce<unknown>((node, key) => (node as Record<string, unknown> | undefined)?.[key], messages);
const slugs = new Set(bundle.worlds.flatMap((w) => w.modules.flatMap((m) => m.levels.map((l) => l.slug))));

describe.each(EXPLAINERS.map((e) => [e.id, e] as const))("explainer %s", (_id, explainer) => {
  it("lasts 20 to 40 seconds", () => {
    expect(explainer.durationMs).toBeGreaterThanOrEqual(20_000);
    expect(explainer.durationMs).toBeLessThanOrEqual(40_000);
  });

  it("starts at zero and every beat starts in order, inside the running time", () => {
    expect(explainer.beats[0]!.atMs).toBe(0);
    for (let i = 1; i < explainer.beats.length; i++) {
      expect(explainer.beats[i]!.atMs).toBeGreaterThan(explainer.beats[i - 1]!.atMs);
    }
    expect(explainer.beats.at(-1)!.atMs).toBeLessThan(explainer.durationMs);
  });

  it("uses the cast in their six states", () => {
    for (const beat of explainer.beats) {
      expect(CHARACTER_IDS).toContain(beat.character);
      expect(CHARACTER_STATES).toContain(beat.state);
    }
  });

  it("shows a concrete mistake", () => {
    const scenes = JSON.stringify(explainer.beats.map((b) => b.scene));
    expect(scenes.includes('"wrong"') || explainer.beats.some((b) => b.state === "error") || scenes.includes('"chat"')).toBe(true);
  });

  it("has a caption for every beat, a title and the whole ending choice, in English and Arabic", () => {
    for (const messages of [en, ar]) {
      expect(at(messages, `explainers.${explainer.id}.title`)).toBeTypeOf("string");
      explainer.beats.forEach((_beat, i) => expect(at(messages, `explainers.${explainer.id}.beats.${i}`), `beat ${i}`).toBeTypeOf("string"));
      expect(at(messages, `explainers.${explainer.id}.choice.question`)).toBeTypeOf("string");
      for (const option of explainer.choice.options) {
        expect(at(messages, `explainers.${explainer.id}.choice.options.${option}`), option).toBeTypeOf("string");
        expect(at(messages, `explainers.${explainer.id}.choice.replies.${option}`), option).toBeTypeOf("string");
      }
    }
  });

  it("ends on a choice with one best answer among several", () => {
    expect(explainer.choice.options.length).toBeGreaterThanOrEqual(2);
    expect(explainer.choice.options).toContain(explainer.choice.best);
  });

  it("is offered on a level that exists", () => {
    expect(slugs.has(explainer.levelSlug), explainer.levelSlug).toBe(true);
    expect(EXPLAINER_FOR_LEVEL[explainer.levelSlug]).toBe(explainer.id);
  });
});

describe("the three explainers from the handoff", () => {
  it("covers the colour mistake (25 s), fair examples (30 s) and checking a source (30 s)", () => {
    expect(EXPLAINERS.map((e) => [e.id, e.durationMs])).toEqual([
      ["copied-colour", 25_000],
      ["fair-examples", 30_000],
      ["check-the-source", 30_000],
    ]);
    expect(at(en, "explainers.copied-colour.beats.4")).toBe("Ruli: I copied the colour. What should I look at instead?");
    expect(at(en, "explainers.fair-examples.beats.3")).toMatch(/Were our examples fair/);
  });

  it("finds the beat showing at any moment", () => {
    const e = EXPLAINERS[0]!;
    expect(beatIndexAt(e, 0)).toBe(0);
    expect(beatIndexAt(e, 4_999)).toBe(0);
    expect(beatIndexAt(e, 5_000)).toBe(1);
    expect(beatIndexAt(e, 24_999)).toBe(e.beats.length - 1);
  });
});
