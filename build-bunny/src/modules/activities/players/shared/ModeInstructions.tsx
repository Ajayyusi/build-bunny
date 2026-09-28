"use client";

import { useTranslations } from "next-intl";

import type { AiMode } from "@/modules/students/ai-mode";

/**
 * What the bunny says at the top of an AI activity. Grades 3 to 4 (younger
 * mode) get the short mission line, with every step one tap away; grades 5
 * to 7 get the full instructions (handoff: simpler text for 3-4).
 */
export function ModeInstructions({
  mode,
  mission,
  instructions,
}: {
  mode: AiMode | undefined;
  mission: string;
  instructions: string;
}) {
  const t = useTranslations("student.play.aiMode");
  if (mode !== "younger" || !mission || mission === instructions) return <>{instructions}</>;
  return (
    <>
      <span className="block font-semibold text-ink">{mission}</span>
      <details className="mt-1">
        <summary className="cursor-pointer text-xs font-semibold text-brand underline-offset-4 hover:underline">
          {t("showSteps")}
        </summary>
        <span className="mt-1 block">{instructions}</span>
      </details>
    </>
  );
}
