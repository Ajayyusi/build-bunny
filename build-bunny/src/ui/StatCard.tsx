import type { ReactNode } from "react";

import { cn } from "./cn";
import { CountUp } from "./CountUp";

export interface StatCardProps {
  label: ReactNode;
  value: ReactNode;
  /**
   * Opt in to a count-up tween on mount (numeric `value` only).
   *
   * Deliberately NOT the default: staff and platform dashboards are
   * Operate-mode surfaces where a KPI briefly rendering a number that
   * isn't the real one ("0 schools" on the way up to 1) reads as wrong
   * data, not delight. Only student-facing surfaces, where the climb is
   * itself the reward, should switch this on.
   */
  countUp?: boolean;
  hint?: ReactNode;
  icon?: ReactNode;
  /**
   * Optional extra class applied to the icon-tile. Used by student home
   * to attach ambient loops (flame flicker, spark, twinkle) to the emoji
   * without touching the base tile styling.
   */
  iconClassName?: string;
  className?: string;
}

export function StatCard({
  label,
  value,
  countUp = false,
  hint,
  icon,
  iconClassName,
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-4 rounded-lg border border-border-token bg-surface-raised p-5 shadow-soft",
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-1">
        <p className="text-sm font-medium text-ink-muted">{label}</p>
        <p className="font-display text-2xl font-bold tabular-nums text-ink">
          {countUp && typeof value === "number" ? (
            <CountUp value={value} />
          ) : (
            value
          )}
        </p>
        {hint ? <p className="text-xs text-ink-muted">{hint}</p> : null}
      </div>
      {icon ? (
        <div
          aria-hidden="true"
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-md bg-brand/10 text-brand [&>svg]:size-5",
            iconClassName,
          )}
        >
          {icon}
        </div>
      ) : null}
    </div>
  );
}
