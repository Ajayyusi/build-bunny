import { describe, expect, it } from "vitest";

import { judgePixelRound } from "@/modules/ai/lab/pixel-playground/judge";
import { freshRound, roundReducer, settledWork, type RoundState } from "@/modules/ai/lab/pixel-playground/round-state";
import { roundSteps } from "@/modules/ai/lab/pixel-playground/steps";
import { stripPixelPlaygroundConfig } from "@/modules/ai/lab/pixel-playground/grade";
import type { PixelPlaygroundConfig } from "@/modules/ai/lab/pixel-playground/types";
import { aiSimPayload } from "@/modules/curriculum/schemas";

import { bundle } from "../../content";

const config: PixelPlaygroundConfig = {
  widgetId: "pixel-playground",
  images: [
    { id: "carrot", src: "/ai-lab/carrot.svg", name: { en: "Carrot" }, clue: { en: "orange, pointing down" } },
    { id: "house", src: "/ai-lab/house.svg", name: { en: "House" } },
  ],
  resolutions: [64, 32, 16, 8],
  rounds: [
    { id: "r1", imageId: "carrot", resolution: 16 },
    { id: "r2", imageId: "house", resolution: 8 },
  ],
};

describe("mystery round steps", () => {
  it("go blockiest first, up to the round's own resolution", () => {
    expect(roundSteps([64, 32, 16, 8], 16)).toEqual([8, 16]);
    expect(roundSteps([64, 32, 16, 8], 8)).toEqual([8]);
    expect(roundSteps([64, 32, 16, 8], 64)).toEqual([8, 16, 32, 64]);
  });
});

describe("checking a mystery round", () => {
  it("a wrong guess with squares still to add reveals nothing", () => {
    expect(judgePixelRound(config, { roundId: "r1", imageId: "house", resolution: 8 })).toEqual({
      correct: false,
      final: false,
      answer: null,
    });
  });

  it("a right guess reveals the picture and its clue", () => {
    expect(judgePixelRound(config, { roundId: "r1", imageId: "carrot", resolution: 8 })).toEqual({
      correct: true,
      final: false,
      answer: { imageId: "carrot", clue: { en: "orange, pointing down" } },
    });
  });

  it("a wrong guess at the clearest step settles the round and shows what it was", () => {
    expect(judgePixelRound(config, { roundId: "r1", imageId: "house", resolution: 16 })).toMatchObject({
      correct: false,
      final: true,
      answer: { imageId: "carrot" },
    });
    // A one-step round is final straight away; no clue authored → null.
    expect(judgePixelRound(config, { roundId: "r2", imageId: "carrot", resolution: 8 })).toEqual({
      correct: false,
      final: true,
      answer: { imageId: "house", clue: null },
    });
  });

  it("refuses rounds and resolutions the level doesn't have", () => {
    expect(judgePixelRound(config, { roundId: "nope", imageId: "carrot", resolution: 8 })).toBeNull();
    // 32 is offered by the level but clearer than round 1 allows.
    expect(judgePixelRound(config, { roundId: "r1", imageId: "carrot", resolution: 32 })).toBeNull();
  });

  it("never ships an answer or a clue to the browser", () => {
    const student = JSON.stringify(stripPixelPlaygroundConfig(config));
    expect(student).not.toContain("imageId");
    expect(student).not.toContain("clue");
    expect(student).not.toContain("orange, pointing down");
  });
});

describe("a mystery round's loop", () => {
  const check = (round: RoundState, resolution: number, roundId = "r1") => {
    const checking = roundReducer(round, { type: "checking" });
    return roundReducer(checking, {
      type: "checked",
      result: judgePixelRound(config, { roundId, imageId: round.selected!, resolution })!,
    });
  };

  it("predict, check, add squares, guess again, and settle", () => {
    let round = roundReducer(freshRound(), { type: "pick", imageId: "house" });
    // Can't check without a guess; with one, it checks.
    expect(roundReducer(freshRound(), { type: "checking" }).status).toBe("guessing");
    round = check(round, 8);
    expect(round).toMatchObject({ status: "notYet", answer: null });
    // Locked until the child asks for more squares.
    expect(roundReducer(round, { type: "pick", imageId: "carrot" }).selected).toBe("house");
    round = roundReducer(round, { type: "moreSquares", stepCount: 2 });
    expect(round).toMatchObject({ step: 1, selected: null, status: "guessing" });
    round = check(roundReducer(round, { type: "pick", imageId: "carrot" }), 16);
    expect(round).toMatchObject({ status: "right", answer: { imageId: "carrot" } });
  });

  it("a missed round shows the answer and can be tried again from the blockiest step", () => {
    let round = check(roundReducer(freshRound(), { type: "pick", imageId: "carrot" }), 8, "r2");
    expect(round).toMatchObject({ status: "missed", answer: { imageId: "house" } });
    round = roundReducer(round, { type: "retry" });
    expect(round).toEqual(freshRound());
  });

  it("a failed check can be retried", () => {
    let round = roundReducer(roundReducer(freshRound(), { type: "pick", imageId: "carrot" }), { type: "checking" });
    round = roundReducer(round, { type: "error" });
    expect(round.status).toBe("error");
    expect(roundReducer(round, { type: "checking" }).status).toBe("checking");
  });

  it("grades only settled rounds, and is ready once all are settled", () => {
    const right = check(roundReducer(freshRound(), { type: "pick", imageId: "carrot" }), 8);
    const guessing = roundReducer(freshRound(), { type: "pick", imageId: "house" });
    expect(settledWork({ r1: right, r2: guessing }, ["r1", "r2"])).toEqual({ work: { rounds: { r1: "carrot" } }, ready: false });
    const missed = check(roundReducer(freshRound(), { type: "pick", imageId: "carrot" }), 8, "r2");
    expect(settledWork({ r1: right, r2: missed }, ["r1", "r2"])).toEqual({
      work: { rounds: { r1: "carrot", r2: "carrot" } },
      ready: true,
    });
  });
});

describe("See Like a Computer content", () => {
  it("gives every picture a clue in both languages", () => {
    const level = bundle.worlds.flatMap((w) => w.modules.flatMap((m) => m.levels)).find((l) => l.slug === "see-like-a-computer")!;
    const widget = aiSimPayload.parse(level.payload).widget;
    if (widget.widgetId !== "pixel-playground") throw new Error("not the pixel playground");
    for (const image of widget.images) {
      expect(image.clue?.en, image.id).toBeTruthy();
      expect(image.clue?.ar, image.id).toBeTruthy();
    }
  });
});
