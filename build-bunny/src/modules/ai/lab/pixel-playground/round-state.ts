import type { PixelRoundStatus } from "@/modules/hints/types";

import type { PixelRoundCheckResult } from "./types";

/**
 * One mystery round's learning loop, as a pure reducer:
 *
 *   guessing  — the picture at its current (blockiest first) step; pick a
 *               guess (PREDICT) and check it (TRY);
 *   notYet    — wrong, with squares still to add: nothing is revealed;
 *               "Add more squares" goes one step clearer (RETRY);
 *   right / missed — settled: the real picture and the clue the child used
 *               or missed (OBSERVE + EXPLAIN); a missed round can be tried
 *               again from its blockiest step.
 */
export interface RoundState {
  /** Index into roundSteps(): 0 is the blockiest. */
  step: number;
  selected: string | null;
  status: PixelRoundStatus;
  answer: PixelRoundCheckResult["answer"];
}

export type RoundAction =
  | { type: "pick"; imageId: string }
  | { type: "checking" }
  | { type: "checked"; result: PixelRoundCheckResult }
  | { type: "error" }
  | { type: "moreSquares"; stepCount: number }
  | { type: "retry" };

export function freshRound(selected: string | null = null): RoundState {
  return { step: 0, selected, status: "guessing", answer: null };
}

export function isSettled(round: RoundState): boolean {
  return round.status === "right" || round.status === "missed";
}

export function roundReducer(round: RoundState, action: RoundAction): RoundState {
  switch (action.type) {
    case "pick":
      return round.status === "guessing" || round.status === "error"
        ? { ...round, selected: action.imageId, status: "guessing" }
        : round;
    case "checking":
      return round.selected && (round.status === "guessing" || round.status === "error")
        ? { ...round, status: "checking" }
        : round;
    case "checked": {
      if (round.status !== "checking") return round;
      const { correct, final, answer } = action.result;
      return { ...round, status: correct ? "right" : final ? "missed" : "notYet", answer };
    }
    case "error":
      return round.status === "checking" ? { ...round, status: "error" } : round;
    case "moreSquares":
      // A fresh guess at the clearer step: the old one was wrong.
      return round.status === "notYet" && round.step < action.stepCount - 1
        ? { ...round, step: round.step + 1, selected: null, status: "guessing" }
        : round;
    case "retry":
      return round.status === "missed" ? freshRound() : round;
  }
}

/**
 * The graded work: each settled round's final guess (a missed round keeps
 * the wrong one — the grader counts it). Ready once every round is settled.
 */
export function settledWork(
  rounds: Readonly<Record<string, RoundState>>,
  roundIds: readonly string[],
): { work: { rounds: Record<string, string> }; ready: boolean } {
  const picks: Record<string, string> = {};
  for (const id of roundIds) {
    const round = rounds[id];
    if (round && isSettled(round) && round.selected) picks[id] = round.selected;
  }
  return { work: { rounds: picks }, ready: roundIds.every((id) => picks[id] !== undefined) };
}
