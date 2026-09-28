import { classify, closeCall, sureness, type ClassLabel, type LabelledSpecimen } from "./knn";

/**
 * The AI project report (capstone): after testing their model on their OWN
 * held-back pile, the child reports one case it got wrong or wasn't sure
 * about, and picks a human safeguard for it.
 *
 * Which cases count is decided here, once, for the player (which marks each
 * case), the grader (which checks the report) and the hint engine. Only the
 * held-back pile is used: its truth already ships to the browser, while the
 * mystery set's truth never does, so a child can only report what they can
 * actually see.
 *
 * A case counts when the model got it wrong, or got it right but only just
 * (a close call). When the model is right and sure about every one, the
 * honest report is the case it was LEAST sure about — there is always
 * something to report, and "nothing went wrong" is never the answer.
 */

export interface HeldCase {
  id: string;
  size: number;
  color: number;
  truth: ClassLabel;
}

export type CaseStatus = "wrong" | "closeCall" | "leastSure" | "right";

export function caseStatuses(
  examples: readonly LabelledSpecimen[],
  held: readonly HeldCase[],
): Record<string, CaseStatus> {
  const statuses: Record<string, CaseStatus> = {};
  const hasBoth = examples.some((e) => e.label === "positive") && examples.some((e) => e.label === "negative");
  if (!hasBoth) return statuses;
  let flagged = false;
  for (const probe of held) {
    const status: CaseStatus =
      classify(examples, probe) !== probe.truth ? "wrong" : closeCall(examples, probe) ? "closeCall" : "right";
    statuses[probe.id] = status;
    if (status !== "right") flagged = true;
  }
  if (!flagged && held.length > 0) {
    let least: HeldCase | null = null;
    let lowest = Infinity;
    for (const probe of held) {
      const sure = sureness(examples, probe) ?? 0;
      if (sure < lowest) {
        lowest = sure;
        least = probe;
      }
    }
    if (least) statuses[least.id] = "leastSure";
  }
  return statuses;
}

/** The held-back cases a report may name. */
export function reportableCases(examples: readonly LabelledSpecimen[], held: readonly HeldCase[]): string[] {
  return Object.entries(caseStatuses(examples, held))
    .filter(([, status]) => status !== "right")
    .map(([id]) => id);
}
