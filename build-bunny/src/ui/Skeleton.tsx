import type { ComponentPropsWithRef } from "react";

import { cn } from "./cn";

const radiusClasses = {
  sm: "rounded-sm",
  md: "rounded-md",
  lg: "rounded-lg",
  xl: "rounded-xl",
  full: "rounded-full",
} as const;

export type SkeletonRadius = keyof typeof radiusClasses;

export interface SkeletonProps extends ComponentPropsWithRef<"div"> {
  radius?: SkeletonRadius;
}

/** Size it via className (e.g. "h-4 w-40"); screen readers skip it. */
export function Skeleton({
  radius = "md",
  className,
  ...rest
}: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse bg-ink/8", radiusClasses[radius], className)}
      {...rest}
    />
  );
}
