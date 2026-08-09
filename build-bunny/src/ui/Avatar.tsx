import { cn } from "./cn";

const sizeClasses = {
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-12 text-base",
} as const;

export type AvatarSize = keyof typeof sizeClasses;

export interface AvatarProps {
  displayName: string;
  size?: AvatarSize;
  className?: string;
}

// First letters of the first and last word; Array.from keeps multi-byte
// characters intact and Arabic simply has no case to change. Empty names
// fall back to the mascot.
function initialsOf(displayName: string): string {
  const parts = displayName.trim().split(/\s+/).filter((part) => part.length > 0);
  const first = parts[0];
  if (first === undefined) return "🐰";
  const last = parts.length > 1 ? parts[parts.length - 1] : undefined;
  const initials = `${Array.from(first)[0] ?? ""}${
    last !== undefined ? (Array.from(last)[0] ?? "") : ""
  }`;
  return initials === "" ? "🐰" : initials.toLocaleUpperCase();
}

export function Avatar({ displayName, size = "md", className }: AvatarProps) {
  return (
    <span
      role="img"
      aria-label={displayName}
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center rounded-full bg-brand/12 font-display font-semibold text-brand",
        sizeClasses[size],
        className,
      )}
    >
      <span aria-hidden="true">{initialsOf(displayName)}</span>
    </span>
  );
}
