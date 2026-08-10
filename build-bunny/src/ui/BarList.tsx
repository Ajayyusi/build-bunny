import type { ReactNode } from "react";

import { cn } from "./cn";

/**
 * Hand-rolled horizontal comparison bars — no chart dependency (M5 analytics
 * & reports). Bar geometry is intentionally rendered `dir="ltr"` even on the
 * Arabic surface: a magnitude bar has no reading-order semantics (unlike
 * text), and forcing it keeps the fill always growing from the bar's own
 * start regardless of page direction — the same call the simulation grid
 * makes ("grid NEVER mirrors in RTL", m3-contracts). Labels/values around it
 * stay in normal (locale-directed) flow.
 */
export interface BarListItem {
  key: string;
  label: ReactNode;
  /** 0–100. */
  value: number;
  valueLabel: ReactNode;
}

export interface BarListProps {
  items: readonly BarListItem[];
  className?: string;
}

export function BarList({ items, className }: BarListProps) {
  return (
    <ul className={cn("flex flex-col gap-2.5", className)}>
      {items.map((item) => {
        const pct = Math.max(0, Math.min(100, item.value));
        return (
          <li key={item.key} className="flex items-center gap-3">
            <span className="w-28 shrink-0 truncate text-sm text-ink-muted">{item.label}</span>
            <svg
              viewBox="0 0 100 10"
              preserveAspectRatio="none"
              style={{ direction: "ltr" }}
              aria-hidden="true"
              className="h-2.5 flex-1"
            >
              <rect x="0" y="0" width="100" height="10" rx="5" className="fill-ink/10" />
              <rect x="0" y="0" width={pct} height="10" rx="5" className="fill-brand" />
            </svg>
            <span className="w-14 shrink-0 text-end text-sm font-semibold tabular-nums text-ink">
              {item.valueLabel}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
