import type { ReactNode } from "react";

import { cn } from "./cn";

export interface ErrorStateProps {
  /** Replaces the default alert icon. */
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /** Usually a retry Button. */
  action?: ReactNode;
  className?: string;
}

export function ErrorState({
  icon,
  title,
  description,
  action,
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-lg border border-danger/30 bg-danger/5 px-6 py-12 text-center",
        className,
      )}
    >
      <div
        aria-hidden="true"
        className="grid size-12 place-items-center rounded-full bg-danger/10 text-danger [&>svg]:size-6"
      >
        {icon ?? (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
            <path d="M12 9v4" />
            <path d="M12 17h.01" />
          </svg>
        )}
      </div>
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
