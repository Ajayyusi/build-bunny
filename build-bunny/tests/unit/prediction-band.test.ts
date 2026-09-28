import { describe, expect, it } from "vitest";

import { dataMiddleX, predictionBand } from "@/modules/ai/lab/math/predictionBand";
import { getAiSimWidgetEngine } from "@/modules/ai/lab/registry";
import { aiSimPayload } from "@/modules/curriculum/schemas";

import { bundle } from "../../content";

const levels = bundle.worlds.flatMap((w) => w.modules.flatMap((m) => m.levels));
const fortune = aiSimPayload.parse(levels.find((l) => l.slug === "fortune-teller")!.payload).widget;
if (fortune.widgetId !== "trend-line") throw new Error("Fortune Teller is a trend line");

describe("the likely range around a prediction", () => {
  it("is narrowest in the middle of the data and widens past it", () => {
    const middle = predictionBand(fortune.points, dataMiddleX(fortune.points));
    const edge = predictionBand(fortune.points, 10);
    const beyond = predictionBand(fortune.points, fortune.predictAt);
    const further = predictionBand(fortune.points, fortune.predictAt + 5);
    expect(middle.beyondData).toBe(false);
    expect(beyond.beyondData).toBe(true);
    expect(edge.halfWidth).toBeGreaterThan(middle.halfWidth);
    expect(beyond.halfWidth).toBeGreaterThan(edge.halfWidth);
    expect(further.halfWidth).toBeGreaterThan(beyond.halfWidth);
  });

  it("Fortune Teller asks for a prediction past the measured data", () => {
    expect(fortune.predictAt).toBeGreaterThan(Math.max(...fortune.points.map((p) => p.x)));
  });

  it("the grader's range is the one the child sees", () => {
    const engine = getAiSimWidgetEngine("trend-line")!;
    const band = predictionBand(fortune.points, fortune.predictAt);
    const graded = engine.grade(fortune, { line: { slope: 2, intercept: 1 }, prediction: band.fitted });
    const round2 = (v: number) => Math.round(v * 100) / 100;
    expect(graded.summary.band).toEqual({ low: round2(band.low), high: round2(band.high) });
    expect(graded.summary.beyondData).toBe(true);
  });
});

describe("no jargon in front of children", () => {
  it("AI levels don't say 'least-squares' anywhere a child reads it", () => {
    for (const l of levels.filter((x) => x.track !== "PROGRAMMING")) {
      // objective and teacherNotes are written for teachers.
      const childFacing = JSON.stringify([l.title, l.story, l.mission, l.instructions, l.explanation, l.keyIdea, l.hints, l.payload]);
      expect(childFacing, l.slug).not.toMatch(/least[- ]squares|المربعات الصغرى|أقل المربعات/i);
    }
  });
});
