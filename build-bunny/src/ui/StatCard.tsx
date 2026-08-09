import type { ReactNode } from "react";

import { cn } from "./cn";

export interface StatCardProps {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  className?: string;
}

export function StatCard({ label, value, hint, icon, className }: StatCardProps) {
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
          {value}
        </p>
        {hint ? <p className="text-xs text-ink-muted">{hint}</p> : null}
      </div>
      {icon ? (
        <div
          aria-hidden="true"
          className="grid size-10 shrink-0 place-items-center rounded-md bg-brand/10 text-brand [&>svg]:size-5"
        >
          {icon}
        </div>
      ) : null}
    </div>
  );
}
