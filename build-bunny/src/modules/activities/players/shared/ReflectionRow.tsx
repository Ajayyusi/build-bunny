"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { saveReflection as saveReflectionAction } from "@/modules/learning/server/actions";
import { cn, runAction } from "@/ui";

import { useLevelContext } from "./level-context";

type Feeling = "EASY" | "JUST_RIGHT" | "TRICKY";

const OPTIONS: { feeling: Feeling; emoji: string; key: string }[] = [
  { feeling: "EASY", emoji: "😀", key: "easy" },
  { feeling: "JUST_RIGHT", emoji: "🙂", key: "justRight" },
  { feeling: "TRICKY", emoji: "😣", key: "tricky" },
];

/**
 * "How did that feel?" — one optional tap on the success card. Nothing to
 * type (no child text is stored); the teacher only ever sees a rough class
 * share. Tapping again changes the answer: saves go one at a time and
 * always end on the latest tap. Renders nothing outside a level.
 */
export function ReflectionRow() {
  const t = useTranslations("student.play.reflection");
  const level = useLevelContext();
  const [chosen, setChosen] = useState<Feeling | null>(null);
  const [saved, setSaved] = useState(false);
  const [failed, setFailed] = useState(false);
  const desired = useRef<Feeling | null>(null);
  const busy = useRef(false);
  if (!level) return null;

  const flush = async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      let sent: Feeling | null = null;
      while (desired.current !== null && desired.current !== sent) {
        const feeling: Feeling = desired.current;
        sent = feeling;
        const result = await runAction(() => saveReflectionAction({ levelId: level.levelId, feeling }));
        if (!result.ok) {
          setFailed(true);
          return;
        }
      }
      setSaved(true);
      setFailed(false);
    } finally {
      busy.current = false;
    }
  };

  const pick = (feeling: Feeling) => {
    setChosen(feeling);
    setSaved(false);
    setFailed(false);
    desired.current = feeling;
    void flush();
  };

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border-token p-3">
      <p id="reflection-question" className="text-sm font-semibold text-ink">
        {t("question")}
      </p>
      <div role="radiogroup" aria-labelledby="reflection-question" className="flex flex-wrap gap-2">
        {OPTIONS.map((option) => (
          <button
            key={option.feeling}
            type="button"
            role="radio"
            aria-checked={chosen === option.feeling}
            onClick={() => void pick(option.feeling)}
            className={cn(
              "inline-flex h-11 items-center gap-2 rounded-full border-2 px-3 text-sm font-semibold transition-colors",
              chosen === option.feeling
                ? "border-brand bg-brand/10 text-ink"
                : "border-border-token text-ink-muted hover:bg-surface-sunken",
            )}
          >
            <span aria-hidden="true" className="text-lg leading-none">
              {option.emoji}
            </span>
            {t(option.key)}
          </button>
        ))}
      </div>
      <p role="status" className="min-h-4 text-xs text-ink-muted">
        {saved ? t("thanks") : failed ? t("notSaved") : ""}
      </p>
    </div>
  );
}
