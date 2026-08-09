"use client";

import { useTranslations } from "next-intl";

import type { StudentFlag } from "@/modules/analytics/server/teacher";
import { Badge, type BadgeVariant } from "@/ui";

/**
 * Flags are colour AND glyph — never colour alone (m1 hard rule 4 / m4 task
 * 3). Each flag gets its own emoji so a colour-blind teacher, or a black and
 * white printout, still reads the signal.
 */
const FLAG_VARIANT: Record<StudentFlag, BadgeVariant> = {
  STUCK: "danger",
  OVERTIME: "warning",
  HEAVY_HINTS: "warning",
  INACTIVE: "neutral",
  NOT_STARTED: "neutral",
};

const FLAG_GLYPH: Record<StudentFlag, string> = {
  STUCK: "🧩",
  OVERTIME: "⏱️",
  HEAVY_HINTS: "💡",
  INACTIVE: "😴",
  NOT_STARTED: "🌱",
};

export function FlagBadge({ flag }: { flag: StudentFlag }) {
  const t = useTranslations("staff.teach.flags");
  return (
    <Badge variant={FLAG_VARIANT[flag]} className="gap-1">
      <span aria-hidden="true">{FLAG_GLYPH[flag]}</span>
      {t(flag)}
    </Badge>
  );
}

export function FlagList({ flags }: { flags: StudentFlag[] }) {
  if (flags.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {flags.map((flag) => (
        <FlagBadge key={flag} flag={flag} />
      ))}
    </div>
  );
}
