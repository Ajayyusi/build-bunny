import type { LocalizedText } from "@/modules/curriculum/schemas";

/**
 * Tiny client-safe localize helper, local to the AI Lab widget players.
 * Deliberately NOT importing `resolveLocalized` from
 * `@/modules/activities/types` — these widgets are meant to be usable
 * standalone (the activities module glues them in via AiSimPlayer, not the
 * other way around), so this directory keeps zero dependency on it.
 */
export function resolveLocalized(value: LocalizedText | undefined, locale: string): string {
  if (!value) return "";
  if (locale === "ar" && value.ar) return value.ar;
  return value.en;
}
