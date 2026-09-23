import { Link } from "@/i18n/navigation";
import { cn } from "@/ui";

export interface WorldCardVM {
  id: string;
  name: string;
  theme: string;
  emoji: string;
  completedLevels: number;
  totalLevels: number;
  locked: boolean;
}

interface WorldCardProps {
  world: WorldCardVM;
  levelsLabel: string;
  progressSr: string;
  /** Shown on a locked world in place of a link — "Opens later". */
  lockedLabel: string;
  /** 0-based position, drives the entrance stagger. */
  index: number;
}

/**
 * Tinted icon tile per world family. The adventure map already colors its
 * bands by theme substring (adventure.module.css); this mirrors those
 * families so a world reads as "the same place" in both surfaces.
 * Authored theme strings are matched by substring with a neutral fallback.
 */
function tileTint(theme: string): string {
  const t = theme.toLowerCase();
  if (t.includes("meadow")) return "bg-brand/15";
  if (t.includes("forest")) return "bg-info/15";
  if (t.includes("robot") || t.includes("lab")) return "bg-info/20";
  if (t.includes("desert")) return "bg-accent/25";
  if (t.includes("island") || t.includes("city")) return "bg-info/15";
  if (t.includes("ml") || t.includes("space")) return "bg-danger/12";
  return "bg-accent/20";
}

export function WorldCard({
  world,
  levelsLabel,
  progressSr,
  lockedLabel,
  index,
}: WorldCardProps) {
  const pct =
    world.totalLevels === 0
      ? 0
      : Math.round((world.completedLevels / world.totalLevels) * 100);

  const inner = (
    <>
      <span className="flex items-start justify-between gap-2">
        <span
          aria-hidden="true"
          className={cn(
            "grid size-11 place-items-center rounded-xl text-2xl",
            tileTint(world.theme),
            world.locked && "grayscale",
          )}
        >
          {world.emoji}
        </span>
        {world.locked ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-surface-sunken px-2 py-1 text-[11px] font-bold text-ink-muted">
            <span aria-hidden="true">🔒</span>
            {lockedLabel}
          </span>
        ) : null}
      </span>
      <span className="mt-3 line-clamp-2 font-display text-sm font-bold text-ink">
        {world.name}
      </span>
      <span className="mt-0.5 text-xs text-ink-muted">{levelsLabel}</span>

      {/* Progress rail. The sr-only text carries the real numbers; the bar
          itself is decorative so screen readers don't read a bare percent. */}
      <span className="mt-3 block h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken">
        <span
          aria-hidden="true"
          className="block h-full rounded-full bg-brand transition-[width] duration-700 ease-out"
          style={{ width: `${pct}%` }}
        />
      </span>
      <span className="sr-only">{progressSr}</span>
    </>
  );

  // Locked worlds are dimmed with a sunken surface, grayscale icon and a
  // lock badge — NOT opacity: the bb-cascade entrance animation ends at
  // opacity 1 with fill-mode both, which silently overrode `opacity-60` and
  // made every locked world look exactly as open as the first one.
  const shared = cn(
    "bb-cascade flex flex-col rounded-xl border border-border-token p-4",
    world.locked
      ? "border-dashed bg-surface-sunken text-ink-muted"
      : "bg-surface-raised shadow-soft",
  );

  if (world.locked) {
    // Locked worlds are not links — there is nothing to open yet.
    return (
      <li
        className={shared}
        style={{ "--i": index } as React.CSSProperties}
      >
        {inner}
      </li>
    );
  }

  return (
    <li className="contents">
      <Link
        href="/adventure"
        className={cn(shared, "bb-pop transition-shadow hover:shadow-raised")}
        style={{ "--i": index } as React.CSSProperties}
      >
        {inner}
      </Link>
    </li>
  );
}
