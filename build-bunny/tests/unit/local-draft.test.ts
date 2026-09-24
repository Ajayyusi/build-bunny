// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";

import {
  currentDraftVersion,
  readLocalDesign,
  readLocalDraft,
  recordDraftVersion,
  stableStringify,
  writeLocalDesign,
  writeLocalDraft,
} from "@/modules/activities/players/shared/local-draft";

/**
 * The device copy of a child's work is trusted only while the server still
 * holds the draft version it was based on. These pin the version
 * bookkeeping that decides that (review findings: a remount, a design save
 * or a hidden-tab save must never leave the device copy on a stale version).
 */

const kid = { playerKey: "kid-a", levelId: "level-1" };

beforeEach(() => window.localStorage.clear());

describe("page-level draft version", () => {
  it("starts from the rendered version and follows every save from this page", () => {
    expect(currentDraftVersion(kid, "V0")).toBe("V0");
    recordDraftVersion(kid, "V1");
    // A grid remounted inside the same page (the maze's Build) sees V1, not V0.
    expect(currentDraftVersion(kid, "V0")).toBe("V1");
  });

  it("a fresh server render starts again from what the server says", () => {
    currentDraftVersion(kid, "V0");
    recordDraftVersion(kid, "V1");
    expect(currentDraftVersion(kid, "V2")).toBe("V2");
  });

  it("a save moves the device copies' base with it (blocks and maze design)", () => {
    currentDraftVersion(kid, "V0");
    writeLocalDraft(kid, { blocks: 1 }, "V0");
    writeLocalDesign(kid, { rows: ["..."] }, "V0");
    recordDraftVersion(kid, "V1");
    expect(readLocalDraft(kid)).toEqual({ json: { blocks: 1 }, base: "V1" });
    expect(readLocalDesign(kid)?.base).toBe("V1");
  });
});

describe("comparing programs", () => {
  it("ignores key order", () => {
    expect(stableStringify({ a: 1, b: { c: 2, d: [1, { e: 3, f: 4 }] } })).toBe(
      stableStringify({ b: { d: [1, { f: 4, e: 3 }], c: 2 }, a: 1 }),
    );
    expect(stableStringify({ a: 1 })).not.toBe(stableStringify({ a: 2 }));
  });
});
