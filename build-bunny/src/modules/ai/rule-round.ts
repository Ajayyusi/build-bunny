/**
 * The "rule or examples?" round, shared by the player, the next-step hints
 * and the content suite so they can never disagree about what a rule card
 * says. Client-safe: plain functions, no imports.
 */

export interface RuleCard {
  id: string;
  feature: "size" | "color";
  positiveWhen: "below" | "above";
  threshold: number;
}

export interface KnownSpecimen {
  id: string;
  size: number;
  color: number;
  truth: "positive" | "negative";
}

/** What a rule card calls this specimen. */
export function ruleSays(rule: RuleCard, specimen: { size: number; color: number }): "positive" | "negative" {
  const below = specimen[rule.feature] < rule.threshold;
  return below === (rule.positiveWhen === "below") ? "positive" : "negative";
}

/** Ids of the specimens a rule gets wrong. */
export function ruleMisses(rule: RuleCard, specimens: readonly KnownSpecimen[]): string[] {
  return specimens.filter((s) => ruleSays(rule, s) !== s.truth).map((s) => s.id);
}

/** The rule cards that fit every one of yesterday's specimens. */
export function fittingRules<R extends RuleCard>(rules: readonly R[], yesterday: readonly KnownSpecimen[]): R[] {
  return rules.filter((rule) => ruleMisses(rule, yesterday).length === 0);
}
