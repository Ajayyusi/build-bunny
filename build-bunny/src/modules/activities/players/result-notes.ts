import { leastSquares } from "@/modules/ai/lab/math/leastSquares";
import { predictionBand } from "@/modules/ai/lab/math/predictionBand";
import { sumSquaredError } from "@/modules/ai/lab/math/sumSquaredError";
import type { Point } from "@/modules/ai/lab/math/types";

/**
 * The result card's three lines for an AI activity (the handoff's result
 * screen): what you tried, what changed, and one more case to test. Built
 * from what the child actually did on this run — never generic praise.
 * Each line is a message key under student.play.resultNotes plus its
 * values, or authored text (an ethics level's own "try next").
 */
export type ResultLine = { key: string; values?: Record<string, string | number> } | { text: string };

export interface ResultNotes {
  tried: ResultLine;
  changed: ResultLine;
  tryNext: ResultLine;
}

const round1 = (value: number) => Math.round(value * 10) / 10;
/** "1", "1 and 3", "1, 2 and 3" — joined by the caller's locale word. */
function listNumbers(numbers: number[], and: string): string {
  if (numbers.length <= 1) return numbers.join("");
  return `${numbers.slice(0, -1).join(", ")} ${and} ${numbers[numbers.length - 1]}`;
}

/** See Like a Computer: each round's outcome and the squares it took. */
export function pixelResultNotes(
  rounds: { status: string; squares: number; step: number }[],
  blockiest: number,
  and: string,
): ResultNotes {
  const neededMore = rounds.flatMap((r, i) => (r.status === "right" && r.step > 0 ? [i + 1] : []));
  const missed = rounds.flatMap((r, i) => (r.status === "missed" ? [i + 1] : []));
  const changed: ResultLine =
    missed.length > 0
      ? { key: "pixel.changedMissed", values: { rounds: listNumbers(missed, and), count: missed.length } }
      : neededMore.length > 0
        ? { key: "pixel.changedMore", values: { rounds: listNumbers(neededMore, and), count: neededMore.length } }
        : { key: "pixel.changedNone", values: { squares: blockiest } };
  return {
    tried: { key: "pixel.tried", values: { count: rounds.length } },
    changed,
    tryNext: { key: "pixel.tryNext", values: { squares: blockiest } },
  };
}

/** Fortune Teller: the child's line and guess against the computer's. */
export function trendResultNotes(input: {
  points: readonly Point[];
  predictAt: number;
  line: { slope: number; intercept: number };
  prediction: number;
  failedChecks: number;
}): ResultNotes {
  const best = leastSquares(input.points);
  const band = predictionBand(input.points, input.predictAt);
  const inside = input.prediction >= band.low && input.prediction <= band.high;
  const lastX = Math.max(...input.points.map((p) => p.x));
  return {
    tried: {
      key: inside ? "trend.triedInside" : "trend.triedOutside",
      values: {
        miss: round1(sumSquaredError(input.points, input.line)),
        best: round1(sumSquaredError(input.points, best)),
        guess: round1(input.prediction),
        x: input.predictAt,
      },
    },
    changed:
      input.failedChecks > 0
        ? { key: "trend.changedChecks", values: { checks: input.failedChecks + 1 } }
        : { key: "trend.changedFirst" },
    // As far past the prediction as the prediction was past the data.
    tryNext: { key: "trend.tryNext", values: { further: input.predictAt + (input.predictAt > lastX ? input.predictAt - lastX : 2), x: input.predictAt } },
  };
}

/** An ethics story: choices, earlier tries and changes of mind. */
export function ethicsResultNotes(
  path: { choiceId: string; tried?: string[] }[],
  tryNext: string | null,
): ResultNotes {
  // Other choices looked at, not counting the one gone on with.
  const others = path.reduce((n, step) => n + (step.tried ?? []).filter((id) => id !== step.choiceId).length, 0);
  // A change of mind: the choice gone on with isn't the first one picked.
  const changes = path.filter((step) => step.tried?.length && step.tried[0] !== step.choiceId).length;
  return {
    tried: { key: "ethics.tried", values: { choices: path.length, others } },
    changed: changes > 0 ? { key: "ethics.changed", values: { count: changes } } : { key: "ethics.changedNone" },
    tryNext: tryNext ? { text: tryNext } : { key: "ethics.tryNext" },
  };
}
