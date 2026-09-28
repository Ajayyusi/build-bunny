"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { useRouter } from "@/i18n/navigation";
import type { AiMode, AiModeChoice } from "@/modules/students/ai-mode";
import { setMyAiModeAction } from "@/modules/students/server/ai-mode-actions";
import { cn, runAction } from "@/ui";

/**
 * "Simpler words" or "More detail" for the AI activities. The child can
 * switch at any time; it changes how things are shown, never progress.
 */
export function AiModeSwitch({
  mode,
  gradeMode,
  choice,
}: {
  mode: AiMode;
  /** The mode the child's grade gives ("Use my grade" goes back to it). */
  gradeMode: AiMode;
  choice: AiModeChoice;
}) {
  const t = useTranslations("student.explore.mode");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [current, setCurrent] = useState<AiMode>(mode);
  // The saved choice is tracked here too, not only through a refresh: in
  // production builds router.refresh() on this page doesn't always land,
  // and "Use my grade" stayed on screen after it had been used.
  const [saved, setSaved] = useState<AiModeChoice>(choice);

  const pick = async (next: AiModeChoice) => {
    setBusy(true);
    try {
      const result = await runAction(() => setMyAiModeAction({ choice: next }));
      if (result.ok) {
        setCurrent(next === "auto" ? gradeMode : next);
        setSaved(next);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div role="radiogroup" aria-label={t("label")} className="flex flex-wrap items-center gap-1.5 text-xs">
      <span className="font-semibold text-ink-muted">{t("label")}</span>
      {(["younger", "older"] as const).map((option) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={current === option}
          disabled={busy}
          onClick={() => void pick(option)}
          className={cn(
            "min-h-9 rounded-full border px-3 font-semibold transition-colors disabled:opacity-60",
            current === option ? "border-brand bg-brand/10 text-ink" : "border-border-token bg-surface-raised text-ink-muted hover:text-ink",
          )}
        >
          {t(option)}
        </button>
      ))}
      {saved !== "auto" ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => void pick("auto")}
          className="min-h-9 px-2 font-semibold text-brand underline-offset-4 hover:underline disabled:opacity-60"
        >
          {t("auto")}
        </button>
      ) : null}
    </div>
  );
}
