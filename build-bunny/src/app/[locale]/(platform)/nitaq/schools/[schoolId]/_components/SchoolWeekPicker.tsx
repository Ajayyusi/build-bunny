"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { Button, cn, runAction, useToast } from "@/ui";

import { setSchoolWeekAction } from "../../actions";

interface Props {
  schoolId: string;
  /** Currently stored ISO weekdays, or null when never set. */
  current: number[] | null;
}

/** ISO weekdays, Monday first, matching the stored representation. */
const DAYS = [1, 2, 3, 4, 5, 6, 7] as const;
/** Sunday–Thursday: the Gulf school week, and the schema's own default market. */
const GULF_WEEK = [1, 2, 3, 4, 7];
const WESTERN_WEEK = [1, 2, 3, 4, 5];

const sameWeek = (a: number[], b: number[]) =>
  a.length === b.length && [...a].sort().every((day, i) => day === [...b].sort()[i]);

/**
 * Which days this school actually teaches on.
 *
 * `School.weekStructure` had three readers — the streak engine and two
 * teacher-analytics paths — and no writer anywhere, so every school fell
 * back to Mon–Fri. That is the wrong default for the market this product is
 * sold into: the Gulf school week is Sunday–Thursday, and the schema's own
 * default timezone is Asia/Dubai.
 *
 * The cost of leaving it unset is not cosmetic. A child who works every
 * single school day still loses their streak, because Monday looks back to
 * Friday — a day their school does not teach — and their Sunday work is
 * discarded entirely. This control is the missing write path.
 */
export function SchoolWeekPicker({ schoolId, current }: Props) {
  const t = useTranslations("platform.schools.week");
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  // Unset reads as Mon–Fri, because that is what the engine actually does
  // today — showing an empty row would hide the behaviour being corrected.
  const [days, setDays] = useState<number[]>(current ?? WESTERN_WEEK);

  const dirty = current === null || !sameWeek(days, current);

  const toggle = (day: number) => {
    setDays((now) =>
      now.includes(day) ? now.filter((d) => d !== day) : [...now, day].sort(),
    );
  };

  const save = () => {
    if (days.length === 0) return;
    startTransition(async () => {
      const result = await runAction(() => setSchoolWeekAction({ schoolId, days }));
      if (result.ok) {
        toast({ title: t("saved"), variant: "positive" });
        router.refresh();
      } else {
        setDays(current ?? WESTERN_WEEK);
        toast({ title: t("failed"), variant: "danger" });
      }
    });
  };

  return (
    <div className="flex flex-col gap-3">
      {current === null ? (
        <p className="rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-ink">
          {t("unset")}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {DAYS.map((day) => {
          const on = days.includes(day);
          return (
            <button
              key={day}
              type="button"
              onClick={() => toggle(day)}
              aria-pressed={on}
              disabled={pending}
              className={cn(
                "h-11 min-w-16 rounded-lg border px-3 text-sm font-semibold transition-colors",
                on
                  ? "border-brand bg-brand text-on-brand"
                  : "border-border-token bg-surface-raised text-ink-muted hover:text-ink",
              )}
            >
              {t(`days.${day}`)}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={save} loading={pending} disabled={pending || !dirty || days.length === 0}>
          {t("save")}
        </Button>
        {/* Presets, because the two that matter are one click and getting a
            seven-button pattern right by hand invites a typo nobody notices
            until a child's streak breaks. */}
        <Button variant="secondary" onClick={() => setDays(GULF_WEEK)} disabled={pending}>
          {t("presetGulf")}
        </Button>
        <Button variant="secondary" onClick={() => setDays(WESTERN_WEEK)} disabled={pending}>
          {t("presetWestern")}
        </Button>
      </div>

      <p className="text-xs text-ink-muted">{t("help")}</p>
    </div>
  );
}
