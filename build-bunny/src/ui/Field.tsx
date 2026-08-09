import { cloneElement, useId, type ReactElement, type ReactNode } from "react";

import { cn } from "./cn";

interface FieldControlProps {
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean | "true" | "false";
}

export interface FieldProps {
  label: ReactNode;
  /** A single form control (Input, Select, textarea…) that accepts id/aria props. */
  children: ReactElement<FieldControlProps>;
  hint?: ReactNode;
  /** When set, replaces the hint and marks the control invalid. */
  error?: ReactNode;
  /** Overrides the generated control id. */
  id?: string;
  className?: string;
}

export function Field({
  label,
  children,
  hint,
  error,
  id: idProp,
  className,
}: FieldProps) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const hasError = error !== undefined && error !== null;
  const hasHint = hint !== undefined && hint !== null;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  // The hint is hidden while an error shows, so only one id is referenced.
  const describedBy = hasError ? errorId : hasHint ? hintId : undefined;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-semibold text-ink">
        {label}
      </label>
      {cloneElement(children, {
        id,
        "aria-describedby": describedBy,
        "aria-invalid": hasError ? true : children.props["aria-invalid"],
      })}
      {hasHint && !hasError ? (
        <p id={hintId} className="text-sm text-ink-muted">
          {hint}
        </p>
      ) : null}
      {hasError ? (
        <p id={errorId} className="text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
