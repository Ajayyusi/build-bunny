import { cn } from "./cn";

export type BunnyMood = "idle" | "hop" | "wave" | "walk";
export type BunnySize = "sm" | "md" | "lg" | "xl";

export interface BunnyMascotProps {
  /**
   * Motion state:
   *  - `idle` : gentle breathing bob, forever (offscreen-safe)
   *  - `hop`  : one-shot entrance hop, then settles into idle
   *  - `wave` : slight side-to-side tilt as if waving hi
   *  - `walk` : leaning forward with a light bob — meant to be paired with
   *             a container that translates it along a trail
   * All animations are pure CSS and honor prefers-reduced-motion.
   */
  mood?: BunnyMood;
  size?: BunnySize;
  className?: string;
  /**
   * Accessible label. Defaults to "Bunny mascot" — override with the
   * localized string where the mascot carries meaning (empty state, etc.).
   */
  label?: string;
}

const sizeClasses: Record<BunnySize, string> = {
  sm: "text-2xl",
  md: "text-4xl",
  lg: "text-6xl",
  xl: "text-[112px] leading-none",
};

const moodClasses: Record<BunnyMood, string> = {
  idle: "bunny-idle",
  hop: "bunny-hop",
  wave: "bunny-wave",
  walk: "bunny-walk",
};

/**
 * The friendly emoji-first bunny mascot used across student surfaces.
 * Wraps the 🐰 glyph (the product's established identity — see grep for
 * every mascot slot) in an animated shell so it feels alive without
 * introducing a new visual language or asset pipeline.
 *
 * The animations live in globals.css so this component ships zero CSS of
 * its own and stays server-renderable.
 */
export function BunnyMascot({
  mood = "idle",
  size = "md",
  className,
  label = "Bunny mascot",
}: BunnyMascotProps) {
  return (
    <span
      role="img"
      aria-label={label}
      className={cn(
        "relative inline-block select-none [transform-origin:50%_90%]",
        sizeClasses[size],
        moodClasses[mood],
        className,
      )}
    >
      <span aria-hidden="true">🐰</span>
    </span>
  );
}
