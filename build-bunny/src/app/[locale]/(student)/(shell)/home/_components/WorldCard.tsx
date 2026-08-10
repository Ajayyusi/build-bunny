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
  index,
}: WorldCardProps) {
  const pct =
    world.totalLevels === 0
      ? 0
      : Math.round((world.completedLevels / world.totalLevels) * 100);

  const inner = (
    <>
      <span
        aria-hidden="true"
        className={cn(
          "grid size-11 place-items-center rounded-xl text-2xl",
          tileTint(world.theme),
        )}
      >
        {world.emoji}
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

  const shared = cn(
    "bb-cascade flex flex-col rounded-xl border border-border-token bg-surface-raised p-4 shadow-soft",
    world.locked && "opacity-60",
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
