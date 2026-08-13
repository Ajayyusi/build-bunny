import { cn } from "./cn";

export interface StarBurstProps {
  /** Number of particles; keep small — this loops nowhere and burns nothing. */
  count?: number;
  className?: string;
}

/**
 * One-shot radial star-particle burst for celebration moments. Purely
 * decorative (aria-hidden), transform/opacity only, absolutely positioned
 * over its nearest relative ancestor and click-transparent. Under
 * prefers-reduced-motion the global clamp collapses the animation, so the
 * particles never appear — by design; the celebration copy carries the
 * meaning.
 *
 * Re-mount (via a React key) to replay.
 */
export function StarBurst({ count = 10, className }: StarBurstProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 overflow-visible",
        className,
      )}
    >
      {Array.from({ length: count }, (_, index) => (
        <span
          key={index}
          className="bb-burst-particle"
          style={
            {
              "--a": `${Math.round((360 / count) * index)}deg`,
              "--d": `${72 + (index % 3) * 26}px`,
              "--pd": `${(index % 4) * 60}ms`,
            } as React.CSSProperties
          }
        >
          {index % 2 === 0 ? "★" : "✦"}
        </span>
      ))}
    </span>
  );
}
