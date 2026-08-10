import { cn } from "./cn";

/**
 * Hand-rolled bar sparkline — no chart dependency (M5 analytics & reports).
 * Kept `dir="ltr"` on both locales, same reasoning as BarList: it renders a
 * chronological (oldest → newest, left → right) numeric series, and the
 * product's numeral policy is already Western-digit / LTR everywhere
 * (`-u-nu-latn`) — mirroring the bars but not the numbers would read worse,
 * not better. Per-bar values are exposed to assistive tech via `ariaLabel`
 * (one summary) rather than per-rect text, which next-intl/RTL text inside
 * SVG handles poorly.
 */
export interface SparklinePoint {
  label: string;
  value: number;
}

export interface SparklineProps {
  points: readonly SparklinePoint[];
  ariaLabel: string;
  className?: string;
}

const BAR_WIDTH = 6;
const GAP = 2;
const HEIGHT = 32;

export function Sparkline({ points, ariaLabel, className }: SparklineProps) {
  const max = Math.max(1, ...points.map((p) => p.value));
  const width = points.length * (BAR_WIDTH + GAP);
  return (
    <svg
      viewBox={`0 0 ${width} ${HEIGHT}`}
      preserveAspectRatio="none"
      style={{ direction: "ltr" }}
      role="img"
      aria-label={ariaLabel}
      className={cn("h-8 w-full", className)}
    >
      {points.map((point, index) => {
        // A floor of 1px keeps a genuinely-zero day visible as a baseline
        // tick rather than disappearing (honest empty-vs-low distinction).
        const barHeight = Math.max(1, Math.round((point.value / max) * HEIGHT));
        const x = index * (BAR_WIDTH + GAP);
        return (
          <rect
            key={point.label}
            x={x}
            y={HEIGHT - barHeight}
            width={BAR_WIDTH}
            height={barHeight}
            rx="1.5"
            className={point.value > 0 ? "fill-brand" : "fill-ink/15"}
          />
        );
      })}
    </svg>
  );
}
