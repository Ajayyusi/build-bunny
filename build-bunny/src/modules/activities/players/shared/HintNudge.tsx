"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/ui";

/**
 * "Try a hint", offered after the second failed check in a row (handoff:
 * "a hint after repeated failure"). The hints are always one tap away in the
 * top bar; this brings them to where a stuck child is looking.
 */
export function HintNudge({ failedChecks, onOpen }: { failedChecks: number; onOpen: () => void }) {
  const t = useTranslations("student.play.feedback");
  if (failedChecks < 2) return null;
  return (
    <Button variant="secondary" size="lg" onClick={onOpen} className="w-fit">
      <span aria-hidden="true">💡</span>
      {t("hintNudge")}
    </Button>
  );
}
