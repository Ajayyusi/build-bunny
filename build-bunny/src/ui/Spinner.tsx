import { cn } from "./cn";

const sizeClasses = {
  sm: "size-4 border-2",
  md: "size-5 border-2",
  lg: "size-7 border-[3px]",
} as const;

export type SpinnerSize = keyof typeof sizeClasses;

export interface SpinnerProps {
  size?: SpinnerSize;
  /**
   * Localized screen-reader label. Omit only when a parent already provides
   * an accessible name (e.g. a loading Button keeps its label visible).
   */
  label?: string;
  className?: string;
}

export function Spinner({ size = "md", label, className }: SpinnerProps) {
  return (
    <span
      role={label ? "status" : undefined}
      aria-hidden={label ? undefined : true}
      className={cn("inline-flex", className)}
    >
      {/* border-t is vertical, so the cut-out is direction-invariant. */}
      <span
        className={cn(
          "inline-block animate-spin rounded-full border-current border-t-transparent",
          sizeClasses[size],
        )}
      />
      {label ? <span className="sr-only">{label}</span> : null}
    </span>
  );
}
