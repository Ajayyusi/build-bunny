/**
 * Age bands (curriculum §4): who a level is written for, and how much
 * scaffolding a child gets — both derived from grade, never from a label
 * on the child.
 *
 *  - The BAND is a property of the level (its recommendedGradeMin) and is
 *    shown as a chip on the map and the briefing: "Ages 7–8", "Ages 9–10",
 *    "Ages 11–13". It sets expectations; it never locks anything.
 *  - The SUPPORT level is a property of the child (their grade) and only
 *    changes how quickly help arrives and whether a stretch idea is offered
 *    after a clean pass. It is never displayed as a category.
 */

export type AgeBand = "starter" | "explorer" | "inventor";
export type SupportLevel = "extra" | "standard" | "stretch";

/** Grade 3 and below → 7–8; grades 4–5 → 9–10; grade 6 and up → 11–13. */
export function ageBandFor(recommendedGradeMin: number | null | undefined): AgeBand | null {
  if (recommendedGradeMin === null || recommendedGradeMin === undefined) return null;
  if (recommendedGradeMin <= 3) return "starter";
  if (recommendedGradeMin <= 5) return "explorer";
  return "inventor";
}

/** A younger child gets help sooner; an older one is offered a stretch. */
export function supportFor(grade: number | null | undefined): SupportLevel {
  if (grade === null || grade === undefined) return "standard";
  if (grade <= 3) return "extra";
  if (grade >= 6) return "stretch";
  return "standard";
}
