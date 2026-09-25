import { resolveText } from "@/modules/curriculum/schemas";
import type { ExploreCardView } from "@/modules/explore/server/queries";

import type { ExploreTileVM } from "./ExploreTile";

/** The subset of next-intl's translator these cards need. */
type Translate = (key: string, values?: Record<string, string | number>) => string;

/** Resolves an Explore card to display strings (t is bound to student.explore). */
export function toTile(card: ExploreCardView, t: Translate, locale: string, lockedAfter?: string): ExploreTileVM {
  const status =
    card.state === "COMPLETED"
      ? t("status.done")
      : card.state === "IN_PROGRESS"
        ? t("status.going")
        : card.state === "LOCKED"
          ? t("status.locked")
          : t("status.new");
  return {
    levelId: card.levelId,
    glyph: card.glyph,
    worldTheme: card.worldTheme,
    conceptName: t(`concept.${card.concept}.name`),
    title: resolveText(card.title, locale),
    hook: t(`concept.${card.concept}.hook`),
    state: card.state,
    stars: card.stars,
    maxStars: card.maxStars,
    statusLabel: status,
    minutesLabel: t("minutes", { minutes: card.estimatedMinutes }),
    starsSr: t("starsSr", { stars: card.stars, max: card.maxStars }),
    explainedLabel: card.explained ? t("explained") : null,
    lockedLabel: lockedAfter ? t("followUpLocked", { after: lockedAfter }) : undefined,
  };
}
