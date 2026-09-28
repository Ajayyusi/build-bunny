/**
 * Grade range modes for the AI activities (handoff P1): grades 3 to 4 see
 * simpler text (the short mission line, friendly feedback); grades 5 to 7
 * can open the proper terms ("What is this called?") and a deeper test
 * (false yes vs missed, close calls). A teacher or the child can switch at
 * any time; it only changes how things are shown, never progress.
 */
export type AiMode = "younger" | "older";
/** What a teacher or child chose; "auto" follows the grade. */
export type AiModeChoice = AiMode | "auto";

export const YOUNGER_MAX_GRADE = 4;

export function aiModeFromGrade(grade: number | null | undefined): AiMode {
  // Unknown grade: the simpler words are the safe default.
  if (grade === null || grade === undefined) return "younger";
  return grade <= YOUNGER_MAX_GRADE ? "younger" : "older";
}

export function aiModeFor(grade: number | null | undefined, stored: "YOUNGER" | "OLDER" | null | undefined): AiMode {
  if (stored === "YOUNGER") return "younger";
  if (stored === "OLDER") return "older";
  return aiModeFromGrade(grade);
}

export function choiceOf(stored: "YOUNGER" | "OLDER" | null | undefined): AiModeChoice {
  return stored === "YOUNGER" ? "younger" : stored === "OLDER" ? "older" : "auto";
}

export function storedFor(choice: AiModeChoice): "YOUNGER" | "OLDER" | null {
  return choice === "younger" ? "YOUNGER" : choice === "older" ? "OLDER" : null;
}
