import type { ReactNode } from "react";

import { cn } from "./cn";

export interface EmptyStateProps {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /** Usually a Button that starts the obvious next step. */
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-lg border border-dashed border-border-token px-6 py-12 text-center",
        className,
      )}
    >
      {icon ? (
        <div
          aria-hidden="true"
          className="grid size-12 place-items-center rounded-full bg-surface-sunken text-ink-muted [&>svg]:size-6"
        >
          {icon}
        </div>
      ) : null}
      <div className="flex flex-col gap-1">
        <h3 className="font-display text-base font-semibold text-ink">
          {title}
        </h3>
        {description ? (
          <p className="max-w-sm text-sm text-ink-muted">{description}</p>
        ) : null}
      </div>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
