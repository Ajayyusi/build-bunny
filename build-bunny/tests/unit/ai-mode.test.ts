import { describe, expect, it } from "vitest";

import { closeCall, confusionCounts, mistakeKinds } from "@/modules/ai/knn";
import { aiModeFor, aiModeFromGrade, choiceOf, storedFor } from "@/modules/students/ai-mode";

describe("grade range modes", () => {
  it("grades 3-4 are younger, 5-7 older; a chosen mode wins; unknown grade is the simpler one", () => {
    expect(aiModeFromGrade(3)).toBe("younger");
    expect(aiModeFromGrade(4)).toBe("younger");
    expect(aiModeFromGrade(5)).toBe("older");
    expect(aiModeFromGrade(7)).toBe("older");
    expect(aiModeFromGrade(null)).toBe("younger");
    expect(aiModeFor(3, "OLDER")).toBe("older");
    expect(aiModeFor(6, "YOUNGER")).toBe("younger");
    expect(aiModeFor(6, null)).toBe("older");
  });

  it("round-trips the stored choice, with auto as null", () => {
    for (const choice of ["younger", "older", "auto"] as const) expect(choiceOf(storedFor(choice))).toBe(choice);
    expect(storedFor("auto")).toBeNull();
  });
});

describe("the deeper test (grades 5-7)", () => {
  const examples = [
    { id: "p", size: 0.1, color: 0.1, label: "positive" as const },
    { id: "n", size: 0.9, color: 0.9, label: "negative" as const },
  ];

  it("a close call is a guess nearly as near to the other label", () => {
    expect(closeCall(examples, { size: 0.5, color: 0.48 })).toBe(true);
    expect(closeCall(examples, { size: 0.12, color: 0.1 })).toBe(false);
    // One label only: nothing to be close to.
    expect(closeCall([examples[0]!], { size: 0.5, color: 0.5 })).toBe(false);
  });

  it("splits mistakes into false yes and missed, from the guess alone", () => {
    const guesses = [
      { id: "a", guess: "positive" as const },
      { id: "b", guess: "negative" as const },
      { id: "c", guess: "positive" as const },
      { id: "d", guess: "negative" as const },
    ];
    expect(mistakeKinds(guesses, ["a", "b", "c"])).toEqual({ falseYes: 2, missedYes: 1 });
    expect(mistakeKinds(guesses, [])).toEqual({ falseYes: 0, missedYes: 0 });
  });

  it("fills the older mode's 2×2 grid from the guesses and the missed list", () => {
    const guesses = [
      { id: "a", guess: "positive" as const },
      { id: "b", guess: "negative" as const },
      { id: "c", guess: "positive" as const },
      { id: "d", guess: "negative" as const },
      { id: "e", guess: null },
    ];
    // a: said yes, wrong (false yes); b: said no, wrong (missed);
    // c: said yes, right; d: said no, right; e: no guess, left out.
    expect(confusionCounts(guesses, ["a", "b", "e"])).toEqual({ rightYes: 1, falseYes: 1, missedYes: 1, rightNo: 1 });
    expect(confusionCounts(guesses, [])).toEqual({ rightYes: 2, falseYes: 0, missedYes: 0, rightNo: 2 });
  });
});

describe("not sure (uncertainty)", () => {
  it("sureness is 1 far from the other kind and 0 halfway", async () => {
    const { sureness } = await import("@/modules/ai/knn");
    const examples = [
      { id: "p", size: 0, color: 0, label: "positive" as const },
      { id: "n", size: 1, color: 0, label: "negative" as const },
    ];
    expect(sureness(examples, { size: 0, color: 0 })).toBe(1);
    expect(sureness(examples, { size: 0.5, color: 0 })).toBe(0);
    expect(sureness([examples[0]!], { size: 0.5, color: 0 })).toBeNull();
    const s = sureness(examples, { size: 0.25, color: 0 })!;
    expect(s).toBeCloseTo(1 - 0.25 / 0.75, 5);
  });
});
