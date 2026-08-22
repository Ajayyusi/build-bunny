/**
 * School feature flags live in School.features (Json, default {}) — e.g.
 * {"adventure": true}. The column is operator-edited, so treat it as hostile
 * input: anything that is not a plain object with `key: true` reads as OFF.
 * Default-off is the product rule (m2 §flags) — a typo can only hide a
 * surface, never expose one.
 */
export function isFeatureEnabled(features: unknown, key: string): boolean {
  if (typeof features !== "object" || features === null || Array.isArray(features)) {
    return false;
  }
  return (features as Record<string, unknown>)[key] === true;
}

/**
 * The flags an operator may actually toggle.
 *
 * This registry exists so the admin UI can only ever offer flags that gate
 * something real. A flag listed here but wired to nothing would be a switch
 * that does not work — worse than no switch — so the rule is: add the entry
 * in the same change that adds the `isFeatureEnabled` call it controls.
 *
 * `descriptionKey` is a messages key, not prose: this module is imported by
 * both server and client code and must stay language-free.
 */
export interface FeatureFlagDefinition {
  key: string;
  /** Suffix under `platform.schools.features.flags.*` in messages. */
  labelKey: string;
}

export const FEATURE_FLAGS: readonly FeatureFlagDefinition[] = [
  // Gates the whole student adventure surface: the map, the nav item, and
  // the level player (4 server-side checks, all default-off).
  { key: "adventure", labelKey: "adventure" },
  // Ranks classmates by XP under their names. Default-off and per-school on
  // purpose: publicly ranking children is a safeguarding decision a school
  // has to make, not a product default, and some will not permit it at all.
  // Deliberately independent of achievements and certificates — a school
  // that declines the ranking still gets every badge and certificate.
  { key: "leaderboard", labelKey: "leaderboard" },
];

const FLAG_KEYS = new Set(FEATURE_FLAGS.map((flag) => flag.key));

export function isKnownFeatureFlag(key: string): boolean {
  return FLAG_KEYS.has(key);
}

/**
 * Apply one toggle to a school's existing flags.
 *
 * Read-modify-write on purpose: flags for other features live in the same
 * JSON column, and writing `{ adventure: true }` wholesale would silently
 * switch every other flag off. Unknown keys already stored are preserved —
 * an operator-set flag this build does not know about is not ours to delete.
 */
export function applyFeatureFlag(
  features: unknown,
  key: string,
  enabled: boolean,
): Record<string, unknown> {
  const base: Record<string, unknown> =
    typeof features === "object" && features !== null && !Array.isArray(features)
      ? { ...(features as Record<string, unknown>) }
      : {};
  base[key] = enabled;
  return base;
}
