import type { ReactNode } from "react";

import { cn } from "./cn";
import { CountUp } from "./CountUp";

export interface StatCardProps {
  label: ReactNode;
  /**
   * Card value. Numbers get a client-side count-up on mount; anything else
   * (formatted strings, JSX) renders as-is so callers with pre-formatted
   * values keep control of presentation.
   */
  value: ReactNode;
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
          {typeof value === "number" ? <CountUp value={value} /> : value}
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
