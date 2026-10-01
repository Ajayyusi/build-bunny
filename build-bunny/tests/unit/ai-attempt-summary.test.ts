import { describe, expect, it } from "vitest";

import { summariseAiAttempt } from "@/modules/ai/attempt-summary";

describe("a Teach-the-bunny attempt, for the teacher", () => {
  const before = { examples: [{ id: "p1", label: "positive" }, { id: "p3", label: "negative" }, { id: "p4", label: "negative" }] };
  const after = {
    examples: [{ id: "p1", label: "positive" }, { id: "p3", label: "positive" }, { id: "p5", label: "positive" }],
    checkSet: ["p6"],
    report: { caseId: "p6", safeguardId: "person-checks" },
  };

  it("lists what was taught, kept back and reported", () => {
    const s = summariseAiAttempt(after, null);
    expect(s.taught).toEqual(after.examples);
    expect(s.heldBack).toEqual(["p6"]);
    expect(s.report).toEqual({ caseId: "p6", safeguardId: "person-checks" });
    expect(s.changes).toBeNull();
  });

  it("names what changed since the previous try: added, taken out, relabelled", () => {
    expect(summariseAiAttempt(after, before).changes).toEqual({ added: ["p5"], removed: ["p4"], relabelled: ["p3"] });
    expect(summariseAiAttempt(before, before).changes).toEqual({ added: [], removed: [], relabelled: [] });
  });

  it("copes with an answer it can't read", () => {
    expect(summariseAiAttempt(null, "junk")).toEqual({ taught: [], heldBack: [], report: null, changes: { added: [], removed: [], relabelled: [] } });
  });
});
