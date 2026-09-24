"use client";

import { useTranslations } from "next-intl";

/**
 * The level's objective, pinned under the player's top bar.
 *
 * Before this, the mission was on the briefing card and nowhere else: once a
 * child pressed "Let's build!" the only way to re-read what they were meant
 * to do was to leave the level. The strip keeps the goal on screen (one
 * line, truncated on narrow screens) and tapping it reopens the full
 * briefing — story, mission and the how-to animation.
 */
export function MissionStrip({
  objective,
  onShow,
}: {
  objective: string;
  onShow: () => void;
}) {
  const t = useTranslations("student.play.mission");
  if (!objective.trim()) return null;
  return (
    <button
      type="button"
      onClick={onShow}
      aria-label={`${t("label")}: ${objective}. ${t("show")}`}
      className="flex min-h-11 w-full shrink-0 items-center gap-2 border-b border-border-token bg-brand/10 px-3 py-1.5 text-start text-sm text-ink transition-colors hover:bg-brand/15 sm:px-4"
    >
      <span aria-hidden="true" className="text-base leading-none">
        🎯
      </span>
      <span className="shrink-0 font-display font-bold">{t("label")}</span>
      <span className="min-w-0 flex-1 truncate font-medium">{objective}</span>
      <span
        aria-hidden="true"
        className="shrink-0 text-xs font-semibold text-ink-muted underline underline-offset-2"
      >
        {t("show")}
      </span>
    </button>
  );
}
