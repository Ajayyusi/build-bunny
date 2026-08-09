import type { ComponentPropsWithRef } from "react";

import { cn } from "./cn";

export interface SelectProps
  extends Omit<ComponentPropsWithRef<"select">, "size"> {
  /** "lg" is 44px tall — required on student surfaces. */
  size?: "md" | "lg";
  /** Marks the field invalid (also settable via aria-invalid, e.g. by Field). */
  invalid?: boolean;
}

export function Select({
  size = "md",
  invalid,
  className,
  children,
  "aria-invalid": ariaInvalid,
  ...rest
}: SelectProps) {
  return (
    <span className={cn("relative inline-flex w-full", className)}>
      <select
        aria-invalid={invalid === true ? true : ariaInvalid}
        className={cn(
          "w-full min-w-0 appearance-none rounded-md border border-ink/20 bg-surface-raised ps-3 pe-9 text-sm text-ink transition-colors",
          "focus-visible:border-brand",
          "disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-ink-muted",
          "aria-invalid:border-danger",
          size === "lg" ? "h-11 text-base" : "h-10",
        )}
        {...rest}
      >
        {children}
      </select>
      {/* Custom chevron: appearance-none removes the native one. Positioned
          with logical `end-*`, so it flips in RTL. */}
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted"
      >
        <path d="m4 6 4 4 4-4" />
      </svg>
    </span>
  );
}
