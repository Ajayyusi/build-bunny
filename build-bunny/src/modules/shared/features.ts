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
