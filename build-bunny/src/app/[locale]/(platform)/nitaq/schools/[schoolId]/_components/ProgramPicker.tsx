"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { Button, Select, useToast } from "@/ui";

import { setSchoolProgramAction } from "../../actions";

interface Props {
  schoolId: string;
  /** Currently enabled programme id, or "" for none. */
  current: string;
  /** Published programmes only — names already resolved for this locale. */
  programs: { id: string; name: string }[];
  /** True when the school has more than one row enabled (see below). */
  ambiguous: boolean;
}

/**
 * Which curriculum a school's students actually get.
 *
 * A school with no programme shows every one of its students the empty
 * "your adventure is being prepared" map, and until this existed there was
 * no way to give it one — only the demo seed ever wrote that row, so any
 * school created through this console was born unusable.
 *
 * A <select> plus an explicit Save rather than save-on-change: this swaps the
 * entire curriculum for a whole school, which is not something an operator
 * should be able to do by brushing a dropdown with the scroll wheel.
 */
export function ProgramPicker({ schoolId, current, programs, ambiguous }: Props) {
  const t = useTranslations("platform.schools.program");
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState(current);

  const dirty = value !== current;

  const save = () => {
    startTransition(async () => {
      const result = await setSchoolProgramAction({ schoolId, programId: value });
      if (result.ok) {
        toast({ title: t("saved"), variant: "positive" });
        router.refresh();
      } else {
        // Snap back: a picker left showing an unsaved value would have an
        // operator believing a school has curriculum it does not.
        setValue(current);
        toast({ title: t("failed"), variant: "danger" });
      }
    });
  };

  return (
    <div className="flex flex-col gap-3">
      {/* The map treats "two programmes" exactly like "none", so this state
          has to be named on screen — otherwise the row looks populated while
          every student sees an empty map. Saving from here repairs it. */}
      {ambiguous ? (
        <p className="rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-ink">
          {t("ambiguous")}
        </p>
      ) : null}

      {programs.length === 0 ? (
        <p className="text-sm text-ink-muted">{t("noneAvailable")}</p>
      ) : (
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex min-w-60 flex-1 flex-col gap-1.5">
            <span className="text-sm font-semibold text-ink">{t("label")}</span>
            <Select
              value={value}
              onChange={(event) => setValue(event.target.value)}
              disabled={pending}
            >
              <option value="">{t("none")}</option>
              {programs.map((program) => (
                <option key={program.id} value={program.id}>
                  {program.name}
                </option>
              ))}
            </Select>
          </label>
          <Button onClick={save} loading={pending} disabled={pending || !dirty}>
            {t("save")}
          </Button>
        </div>
      )}

      <p className="text-xs text-ink-muted">{t("help")}</p>
    </div>
  );
}
