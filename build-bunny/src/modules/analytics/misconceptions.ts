/**
 * Misconception reports (brief §6): what a class keeps getting wrong, in
 * teaching terms, not scores.
 *
 * Every graded run already carries a located feedback code ("bumped at
 * step 3", "the counter ended on 5", "carrots left"). Grouped across a
 * class those codes are a picture of the ideas that have not landed yet —
 * left/right from the bunny's view, counting tiles, where a block sits in a
 * loop — which is what a teacher needs to plan the next ten minutes at the
 * board. Pure and data-only: the copy for each misconception, and the
 * reteach idea that goes with it, lives in the message catalogue.
 */

export type MisconceptionId =
  | "turnDirection"
  | "hazardAhead"
  | "countingHops"
  | "missedStop"
  | "loopNeverEnds"
  | "repeatNotUsed"
  | "sayPlacement"
  | "counterTrace"
  | "requiredBlock"
  | "readingCode"
  | "sequencing"
  | "mazeDesign"
  | "learnGap"
  | "classifierExamples"
  | "trendFit"
  | "groupingFlags";

export const MISCONCEPTION_IDS: readonly MisconceptionId[] = [
  "turnDirection",
  "hazardAhead",
  "countingHops",
  "missedStop",
  "loopNeverEnds",
  "repeatNotUsed",
  "sayPlacement",
  "counterTrace",
  "requiredBlock",
  "readingCode",
  "sequencing",
  "mazeDesign",
  "learnGap",
  "classifierExamples",
  "trendFit",
  "groupingFlags",
];

/** Located feedback code (engine / activity graders) → the idea behind it. */
export const FEEDBACK_MISCONCEPTION: Record<string, MisconceptionId> = {
  bumped: "turnDirection",
  splashed: "hazardAhead",
  notOnGoal: "countingHops",
  carrotsLeft: "missedStop",
  budget: "loopNeverEnds",
  tooManyBlocks: "repeatNotUsed",
  wrongOutput: "sayPlacement",
  wrongVariable: "counterTrace",
  missingBlock: "requiredBlock",
  wrongOption: "readingCode",
  wrongOrder: "sequencing",
  mazeInvalid: "mazeDesign",
  tryAnotherBlock: "learnGap",
  classifierErrors: "classifierExamples",
  trendMissTooHigh: "trendFit",
  pilesNotTight: "groupingFlags",
};

export interface MisconceptionAttemptRow {
  studentUserId: string;
  levelId: string;
  verdict: "PASS" | "PARTIAL" | "FAIL" | "ERROR";
  /** Null when the summary did not record it (older rows). */
  qualityPassed: boolean | null;
  feedbackCode: string | null;
}

export interface MisconceptionLevelCount {
  levelId: string;
  attempts: number;
}

export interface MisconceptionSummary {
  id: MisconceptionId;
  /** Runs that showed this misconception. */
  attempts: number;
  /** Distinct children behind those runs — never named here. */
  students: number;
  /** Where it shows most, most-attempted first (at most three). */
  levels: MisconceptionLevelCount[];
}

/**
 * Which runs count: a FAIL or PARTIAL with a located code, or a PASS whose
 * only shortfall was quality (too many blocks — a loop was available and
 * not used). ERROR is infrastructure, never a misconception.
 */
export function misconceptionOf(row: MisconceptionAttemptRow): MisconceptionId | null {
  if (!row.feedbackCode || row.verdict === "ERROR") return null;
  if (row.verdict === "PASS" && row.qualityPassed !== false) return null;
  return FEEDBACK_MISCONCEPTION[row.feedbackCode] ?? null;
}

export function summarizeMisconceptions(
  rows: readonly MisconceptionAttemptRow[],
  options: { minAttempts?: number; limit?: number } = {},
): MisconceptionSummary[] {
  const minAttempts = options.minAttempts ?? 2;
  const limit = options.limit ?? 6;
  const groups = new Map<
    MisconceptionId,
    { attempts: number; students: Set<string>; levels: Map<string, number> }
  >();
  for (const row of rows) {
    const id = misconceptionOf(row);
    if (!id) continue;
    const group = groups.get(id) ?? { attempts: 0, students: new Set<string>(), levels: new Map() };
    group.attempts += 1;
    group.students.add(row.studentUserId);
    group.levels.set(row.levelId, (group.levels.get(row.levelId) ?? 0) + 1);
    groups.set(id, group);
  }
  return [...groups]
    .filter(([, group]) => group.attempts >= minAttempts)
    .map(([id, group]) => ({
      id,
      attempts: group.attempts,
      students: group.students.size,
      levels: [...group.levels]
        .map(([levelId, attempts]) => ({ levelId, attempts }))
        .sort((a, b) => b.attempts - a.attempts || a.levelId.localeCompare(b.levelId))
        .slice(0, 3),
    }))
    .sort((a, b) => b.attempts - a.attempts || b.students - a.students || a.id.localeCompare(b.id))
    .slice(0, limit);
}
