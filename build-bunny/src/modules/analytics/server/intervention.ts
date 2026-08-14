import type { LocalizedText } from "@/modules/curriculum/schemas";

import type { FlagEvidence, StudentFlag } from "./teacher";

/**
 * Suggested interventions: what a teacher might DO about a flagged student.
 *
 * Deliberately deterministic rules over the same observable rows the flags
 * come from — no scoring model, no external API, nothing a teacher cannot
 * check for themselves. A suggestion always names the evidence that produced
 * it ("five attempts on Loop Garden, all failed"), because a recommendation a
 * teacher cannot audit is worse than none: they either follow it blindly or
 * learn to ignore it.
 *
 * This module is pure. It takes facts and returns structured suggestions with
 * NO prose — the numbers travel as fields and the UI renders localized copy
 * from the kind. That keeps Arabic first-class (a server-side English string
 * would reach an Arabic teacher untranslated) and keeps this unit-testable
 * without a database.
 *
 * These are prompts for a professional, never instructions: the teacher knows
 * the child and this only knows their rows.
 */

export type InterventionKind =
  /** Repeated failure on one level — the concept, not the effort, is the problem. */
  | "REVIEW_CONCEPT"
  /** Finishing, but leaning on the deepest hints to do it. */
  | "HINT_RELIANCE"
  /** Getting there, but taking far longer than the level expects. */
  | "PACING"
  /** Was working, has gone quiet. */
  | "CHECK_IN"
  /** Never started at all. */
  | "GET_STARTED";

export interface SuggestedIntervention {
  kind: InterventionKind;
  /** The level the evidence points at, when the rule names one. */
  levelId: string | null;
  levelTitle: LocalizedText | null;
  /**
   * Numbers the UI interpolates into localized copy. Never prose, so this
   * shape carries no language of its own.
   */
  facts: {
    attempts?: number;
    minutes?: number;
    estimatedMinutes?: number;
    levels?: number;
    days?: number;
  };
}

/**
 * Most actionable first. A teacher scanning a student page acts on the top
 * one or two, so ordering is the feature: a child failing the same level five
 * times needs help before one who is merely slow.
 */
const PRIORITY: InterventionKind[] = [
  "REVIEW_CONCEPT",
  "GET_STARTED",
  "CHECK_IN",
  "HINT_RELIANCE",
  "PACING",
];

export interface InterventionInput {
  flags: StudentFlag[];
  evidence: FlagEvidence;
  /** Level titles for any level the evidence names. */
  levelTitles: Map<string, LocalizedText>;
}

export function suggestInterventions(input: InterventionInput): SuggestedIntervention[] {
  const { flags, evidence, levelTitles } = input;
  const out: SuggestedIntervention[] = [];
  const has = (flag: StudentFlag) => flags.includes(flag);

  if (has("STUCK") && evidence.stuck !== null) {
    out.push({
      kind: "REVIEW_CONCEPT",
      levelId: evidence.stuck.levelId,
      levelTitle: levelTitles.get(evidence.stuck.levelId) ?? null,
      facts: { attempts: evidence.stuck.attempts },
    });
  }

  if (has("NOT_STARTED")) {
    out.push({ kind: "GET_STARTED", levelId: null, levelTitle: null, facts: {} });
  }

  if (has("INACTIVE")) {
    out.push({
      kind: "CHECK_IN",
      levelId: null,
      levelTitle: null,
      facts: evidence.quietSchoolDays === null ? {} : { days: evidence.quietSchoolDays },
    });
  }

  if (has("HEAVY_HINTS")) {
    out.push({
      kind: "HINT_RELIANCE",
      levelId: null,
      levelTitle: null,
      facts: { levels: evidence.hintHeavyLevels },
    });
  }

  // Pacing is the weakest signal on its own: a child who is slow *because*
  // they are stuck is already better served by REVIEW_CONCEPT, and showing
  // both makes the page read as a pile-on about one struggling student.
  if (has("OVERTIME") && evidence.overtime !== null && !has("STUCK")) {
    out.push({
      kind: "PACING",
      levelId: evidence.overtime.levelId,
      levelTitle: levelTitles.get(evidence.overtime.levelId) ?? null,
      facts: {
        minutes: evidence.overtime.minutes,
        estimatedMinutes: evidence.overtime.estimatedMinutes,
      },
    });
  }

  return out.sort((a, b) => PRIORITY.indexOf(a.kind) - PRIORITY.indexOf(b.kind));
}
