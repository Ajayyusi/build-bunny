import type { ComponentPropsWithRef } from "react";

import { cn } from "./cn";

export interface InputProps
  extends Omit<ComponentPropsWithRef<"input">, "size"> {
  /** "lg" is 44px tall — required on student surfaces. */
  size?: "md" | "lg";
  /** Marks the field invalid (also settable via aria-invalid, e.g. by Field). */
  invalid?: boolean;
}

export function Input({
  size = "md",
  invalid,
  className,
  "aria-invalid": ariaInvalid,
  ...rest
}: InputProps) {
  return (
    <input
      aria-invalid={invalid === true ? true : ariaInvalid}
      className={cn(
        "w-full min-w-0 rounded-md border border-ink/20 bg-surface-raised px-3 text-sm text-ink transition-colors",
        "placeholder:text-ink-faint",
        "focus-visible:border-brand",
        "disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-ink-muted",
        "aria-invalid:border-danger",
        size === "lg" ? "h-11 text-base" : "h-10",
        className,
      )}
      {...rest}
    />
  );
}
