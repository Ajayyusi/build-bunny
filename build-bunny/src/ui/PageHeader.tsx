import type { ReactNode } from "react";

import { cn } from "./cn";

export interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  /** Trailing controls (buttons, filters); wraps below the title on small screens. */
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-wrap items-start justify-between gap-x-6 gap-y-3",
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="font-display text-2xl font-bold text-ink">{title}</h1>
        {description ? (
          <p className="text-sm text-ink-muted">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}
