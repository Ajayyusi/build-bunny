"use client";

import {
  useEffect,
  useId,
  useRef,
  type MouseEvent,
  type ReactNode,
} from "react";

import { cn } from "./cn";

const sizeClasses = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-2xl",
} as const;

export type DialogSize = keyof typeof sizeClasses;

export interface DialogProps {
  open: boolean;
  /** Called when the dialog asks to close (Esc, backdrop, close button). */
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  /** Action row, e.g. cancel/confirm Buttons. */
  footer?: ReactNode;
  /**
   * Localized label for the corner close button; omit to hide the button
   * (Esc and footer actions still close).
   */
  closeLabel?: string;
  size?: DialogSize;
  className?: string;
}

/**
 * Modal on the native <dialog> element: focus trap, Esc handling and
 * top-layer rendering come from the platform. State stays with the caller —
 * render conditionally or keep it mounted and toggle `open`.
 */
export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  closeLabel,
  size = "md",
  className,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  // Native close (Esc) fires "close" — mirror it into the open prop.
  const handleClose = () => {
    if (open) onClose();
  };

  // Only clicks on the dialog element itself hit the backdrop region;
  // clicks on content land on descendants.
  const handleClick = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === ref.current) onClose();
  };

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={handleClose}
      onClick={handleClick}
      className={cn(
        // Preflight zeroes margins, so m-auto restores native centering.
        "m-auto w-[calc(100%-2rem)] rounded-xl border border-border-token bg-surface-raised text-ink shadow-overlay",
        sizeClasses[size],
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4 px-5 pb-1 pt-5">
        <h2 id={titleId} className="font-display text-lg font-semibold text-ink">
          {title}
        </h2>
        {closeLabel ? (
          <button
            type="button"
            aria-label={closeLabel}
            onClick={onClose}
            className="-me-2 -mt-1 grid size-9 shrink-0 place-items-center rounded-md text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              className="size-4"
            >
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        ) : null}
      </div>
      <div className="max-h-[min(60vh,32rem)] overflow-y-auto px-5 py-3">
        {children}
      </div>
      {footer ? (
        <div className="flex justify-end gap-2 border-t border-border-token px-5 py-4">
          {footer}
        </div>
      ) : null}
    </dialog>
  );
}
