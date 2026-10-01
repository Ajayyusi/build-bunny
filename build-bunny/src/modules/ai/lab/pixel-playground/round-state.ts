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
 *   named      — then the child names one clue still there in the squares
 *               and one lost in them (handoff, AI Vision: "names a visual
 *               clue the model used and a clue it missed").
 */
export interface RoundState {
  /** Index into roundSteps(): 0 is the blockiest. */
  step: number;
  selected: string | null;
  status: PixelRoundStatus;
  answer: PixelRoundCheckResult["answer"];
  /** The clues the child named once the round settled. */
  named: { kept: string | null; lost: string | null };
}

export type ClueSlot = "kept" | "lost";

export type RoundAction =
  | { type: "pick"; imageId: string }
  | { type: "checking" }
  | { type: "checked"; result: PixelRoundCheckResult }
  | { type: "error" }
  | { type: "moreSquares"; stepCount: number }
  | { type: "retry" }
  | { type: "name"; slot: ClueSlot; clueId: string };

export function freshRound(selected: string | null = null): RoundState {
  return { step: 0, selected, status: "guessing", answer: null, named: { kept: null, lost: null } };
}

/** Is this pick right: a kept clue for "kept", a lost one for "lost"? */
export function clueFits(round: RoundState, slot: ClueSlot, clueId: string | null): boolean {
  const clue = round.answer?.clueChoices?.find((c) => c.id === clueId);
  return clue !== undefined && clue.kept === (slot === "kept");
}

/** Settled, and (where the picture has clues to name) both named right. */
export function isDone(round: RoundState): boolean {
  if (!isSettled(round)) return false;
  if (!round.answer?.clueChoices) return true;
  return clueFits(round, "kept", round.named.kept) && clueFits(round, "lost", round.named.lost);
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
    case "name":
      return isSettled(round) && round.answer?.clueChoices?.some((c) => c.id === action.clueId)
        ? { ...round, named: { ...round.named, [action.slot]: action.clueId } }
        : round;
  }
}

/**
 * The graded work: each settled round's final guess (a missed round keeps
 * the wrong one — the grader counts it). Ready once every round is settled
 * and its clues are named.
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
  const named = roundIds.every((id) => {
    const round = rounds[id];
    return round !== undefined && isDone(round);
  });
  return { work: { rounds: picks }, ready: named && roundIds.every((id) => picks[id] !== undefined) };
}
