import type { ComponentPropsWithRef } from "react";

import { cn } from "./cn";

export function Card({ className, ...rest }: ComponentPropsWithRef<"div">) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border-token bg-surface-raised shadow-soft",
        className,
      )}
      {...rest}
    />
  );
}

export function CardHeader({
  className,
  ...rest
}: ComponentPropsWithRef<"div">) {
  return <div className={cn("flex flex-col gap-1 px-5 pt-5", className)} {...rest} />;
}

export function CardTitle({ className, ...rest }: ComponentPropsWithRef<"h3">) {
  return (
    <h3
      className={cn("font-display text-lg font-semibold text-ink", className)}
      {...rest}
    />
  );
}

export function CardBody({ className, ...rest }: ComponentPropsWithRef<"div">) {
  return <div className={cn("px-5 py-4", className)} {...rest} />;
}

export function CardFooter({
  className,
  ...rest
}: ComponentPropsWithRef<"div">) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 border-t border-border-token px-5 py-4",
        className,
      )}
      {...rest}
    />
  );
}
