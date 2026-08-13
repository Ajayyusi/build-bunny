import type { ComponentPropsWithRef } from "react";

import { cn } from "./cn";

// Tinted fills with the matching AA-safe text step; accent's amber is too
// light for text, so it pairs with ink instead. brand/positive sit at /8
// (not /12 like danger) because the NITAQ green is more saturated than the
// old brand green — at /12 its own tint fell to 4.36:1 against itself,
// under the 4.5:1 gate (recomputed in docs/accessibility.md).
const variantClasses = {
  neutral: "bg-ink/8 text-ink-muted",
  brand: "bg-brand/8 text-brand",
  positive: "bg-positive/8 text-positive",
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
