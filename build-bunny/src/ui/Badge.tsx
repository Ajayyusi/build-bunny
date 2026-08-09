import type { ComponentPropsWithRef } from "react";

import { cn } from "./cn";

// Tinted fills with the matching AA-safe text step; accent's amber is too
// light for text, so it pairs with ink instead.
const variantClasses = {
  neutral: "bg-ink/8 text-ink-muted",
  brand: "bg-brand/12 text-brand",
  positive: "bg-positive/12 text-positive",
  warning: "bg-warning/14 text-warning",
  danger: "bg-danger/12 text-danger",
  accent: "bg-accent/25 text-ink",
} as const;

export type BadgeVariant = keyof typeof variantClasses;

export interface BadgeProps extends ComponentPropsWithRef<"span"> {
  variant?: BadgeVariant;
}

export function Badge({
  variant = "neutral",
  className,
  ...rest
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold",
        variantClasses[variant],
        className,
      )}
      {...rest}
    />
  );
}
