import type { ComponentPropsWithRef } from "react";

import { cn } from "./cn";
import { Spinner } from "./Spinner";

const variantClasses = {
  primary: "bg-brand text-on-brand hover:bg-brand-strong",
  secondary:
    "border border-border-token bg-surface-raised text-ink hover:bg-surface-sunken",
  ghost: "text-ink hover:bg-surface-sunken",
  danger: "bg-danger text-on-brand hover:bg-danger/90",
} as const;

const sizeClasses = {
  sm: "h-8 gap-1.5 rounded-sm px-3 text-sm",
  md: "h-10 gap-2 rounded-md px-4 text-sm",
  // 44px — minimum touch target on student surfaces.
  lg: "h-11 gap-2 rounded-lg px-5 text-base",
} as const;

export type ButtonVariant = keyof typeof variantClasses;
export type ButtonSize = keyof typeof sizeClasses;

export interface ButtonProps extends ComponentPropsWithRef<"button"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Disables the button and shows an inline spinner before the label. */
  loading?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  // Explicit opt-in to submit — implicit form submission is a common bug.
  type = "button",
  disabled,
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex select-none items-center justify-center font-semibold transition-colors",
        "disabled:pointer-events-none disabled:opacity-60",
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...rest}
    >
      {loading ? <Spinner size="sm" /> : null}
      {children}
    </button>
  );
}
