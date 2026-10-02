/**
 * Grouping levels, predict first: before the tightness meter shows, the
 * child says how tight they think their groups are. "Just over" means
 * within 15 points above the bar.
 */
export const TIGHT_GUESSES = ["loose", "justOver", "veryTight"] as const;
export type TightGuess = (typeof TIGHT_GUESSES)[number];

const JUST_OVER = 15;

export function tightGuessFits(guess: TightGuess, scorePct: number, needPct: number): boolean {
  if (guess === "loose") return scorePct < needPct;
  if (guess === "justOver") return scorePct >= needPct && scorePct < needPct + JUST_OVER;
  return scorePct >= needPct + JUST_OVER;
}
