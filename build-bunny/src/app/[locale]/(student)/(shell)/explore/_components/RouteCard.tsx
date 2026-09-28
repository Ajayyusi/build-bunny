import { Link } from "@/i18n/navigation";
import { cn } from "@/ui";

import type { RouteProgress } from "./landing";

/**
 * One of the two routes deeper in from Explore AI: the AI worlds or Coding
 * Lab. The whole card is the link; it says what the route is, the idea that
 * sets it apart (show examples vs. give exact steps), and how far along the
 * child is.
 */
export function RouteCard({
  href,
  glyph,
  title,
  body,
  idea,
  cta,
  progress,
  progressLabel,
  tone,
}: {
  href: "/ai-worlds" | "/adventure";
  glyph: string;
  title: string;
  body: string;
  idea: string;
  cta: string;
  progress: RouteProgress;
  progressLabel: string;
  tone: "ai" | "coding";
}) {
  const pct = progress.total === 0 ? 0 : Math.round((progress.done / progress.total) * 100);
  return (
    <li className="contents">
      <Link
        href={href}
        className="bb-pop flex h-full flex-col gap-2 rounded-2xl border border-border-token bg-surface-raised p-4 shadow-soft transition-transform hover:-translate-y-0.5"
      >
        <span className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className={cn(
              "grid size-10 shrink-0 place-items-center rounded-xl font-bold",
              tone === "ai" ? "bg-brand/15 text-xl" : "bg-surface-sunken font-mono text-sm",
            )}
          >
            {glyph}
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="font-display text-base font-extrabold text-ink">{title}</span>
            <span className="text-xs text-ink-muted">{body}</span>
          </span>
        </span>
        <span className="text-sm text-ink">{idea}</span>
        <span className="mt-auto flex flex-col gap-1 pt-1">
          <span className="flex items-center justify-between gap-2 text-xs font-semibold text-ink-muted">
            <span>{progressLabel}</span>
            <span className="font-bold text-brand">
              {cta}{" "}
              <span aria-hidden="true" className="rtl:hidden">
                →
              </span>
              <span aria-hidden="true" className="hidden rtl:inline">
                ←
              </span>
            </span>
          </span>
          <span aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-surface-sunken">
            <span className="block h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
          </span>
        </span>
      </Link>
    </li>
  );
}
