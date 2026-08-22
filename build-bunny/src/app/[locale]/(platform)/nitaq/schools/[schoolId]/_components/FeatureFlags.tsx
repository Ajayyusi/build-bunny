"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { FEATURE_FLAGS } from "@/modules/shared/features";
import { Button, useToast, runAction } from "@/ui";

import { setSchoolFeatureFlagAction } from "../../actions";

interface Props {
  schoolId: string;
  /** Resolved on the server through the same reader the gates use. */
  features: Record<string, boolean>;
}

/**
 * Per-school feature switches. Until this existed, the only way to turn a
 * surface on for a school was editing a JSONB column by hand in Postgres,
 * which meant anything shipped behind a flag was effectively shipped off.
 *
 * Only registry flags are offered, and each one gates something real — a
 * switch that does nothing is worse than no switch. The optimistic state is
 * reverted if the server rejects the change, so the UI can never sit there
 * claiming a flag is on when it is not.
 */
export function FeatureFlags({ schoolId, features }: Props) {
  const t = useTranslations("platform.schools.features");
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState(features);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const toggle = (key: string) => {
    const next = !state[key];
    setBusyKey(key);
    setState((current) => ({ ...current, [key]: next }));
    startTransition(async () => {
      const result = await runAction(() => setSchoolFeatureFlagAction({ schoolId, key, enabled: next }));
      if (result.ok) {
        toast({ title: next ? t("enabled") : t("disabled"), variant: "positive" });
        router.refresh();
      } else {
        // Put the switch back where it was — a flag that silently failed to
        // save would have an operator believing a school has a surface it
        // does not.
        setState((current) => ({ ...current, [key]: !next }));
        toast({ title: t("failed"), variant: "danger" });
      }
      setBusyKey(null);
    });
  };

  return (
    <ul className="flex flex-col gap-2">
      {FEATURE_FLAGS.map((flag) => {
        const on = state[flag.key] === true;
        return (
          <li
            key={flag.key}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border-token bg-surface-raised px-4 py-3"
          >
            <span className="flex flex-col">
              <span className="text-sm font-semibold text-ink">
                {t(`flags.${flag.labelKey}.name`)}
              </span>
              <span className="text-xs text-ink-muted">
                {t(`flags.${flag.labelKey}.description`)}
              </span>
            </span>
            <span className="flex items-center gap-3">
              <span
                className={
                  on
                    ? "text-xs font-bold uppercase tracking-wide text-positive"
                    : "text-xs font-bold uppercase tracking-wide text-ink-faint"
                }
              >
                {on ? t("on") : t("off")}
              </span>
              <Button
                variant={on ? "secondary" : "primary"}
                size="sm"
                onClick={() => toggle(flag.key)}
                loading={pending && busyKey === flag.key}
                disabled={pending}
                // The label says what pressing it DOES, not what the state
                // is — the state is the badge beside it.
                aria-label={`${on ? t("turnOff") : t("turnOn")} — ${t(`flags.${flag.labelKey}.name`)}`}
              >
                {on ? t("turnOff") : t("turnOn")}
              </Button>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
