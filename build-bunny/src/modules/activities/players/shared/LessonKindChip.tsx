"use client";

import { useTranslations } from "next-intl";

import type { LessonKind } from "@/modules/explore/catalog";
import { Badge } from "@/ui";

/**
 * "AI lesson" or "Digital citizenship" (handoff: tell citizenship missions
 * apart from AI lessons). Coding levels carry no chip: their world already
 * says Coding.
 */
export function LessonKindChip({ kind }: { kind: LessonKind }) {
  const t = useTranslations("student.lessonKind");
  if (kind === "coding") return null;
  return (
    <Badge variant={kind === "ai" ? "brand" : "neutral"}>
      <span aria-hidden="true">{kind === "ai" ? "🧠" : "🛡️"}</span>
      {t(kind)}
    </Badge>
  );
}
