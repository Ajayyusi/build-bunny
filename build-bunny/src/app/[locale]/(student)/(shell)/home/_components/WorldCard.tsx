import { Link } from "@/i18n/navigation";
import { cn, worldColor } from "@/ui";

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

  // Toy Box: every world is its own bold colour (white text ≥ 4.5:1). A
  // locked world keeps a pale tint of its colour with navy text, so it
  // still looks like itself but clearly isn't open yet.
  const color = worldColor(world.theme);
  const inner = (
    <>
      <span className="flex items-start justify-between gap-2">
        <span
          aria-hidden="true"
          className={cn(
            "grid size-12 place-items-center rounded-2xl text-2xl",
            world.locked ? "bg-white/70 grayscale" : "bg-white/25",
          )}
        >
          {world.emoji}
        </span>
        {world.locked ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-bold text-ink">
            <span aria-hidden="true">🔒</span>
            {lockedLabel}
          </span>
        ) : null}
      </span>
      <span
        className={cn(
          "mt-3 line-clamp-2 font-display text-base font-extrabold",
          world.locked ? "text-ink" : "text-white",
        )}
      >
        {world.name}
      </span>
      <span className={cn("mt-0.5 text-xs font-semibold", world.locked ? "text-ink" : "text-white")}>
        {levelsLabel}
      </span>

      {/* Progress rail. The sr-only text carries the real numbers; the bar
          itself is decorative so screen readers don't read a bare percent. */}
      <span
        className={cn(
          "mt-3 block h-2.5 w-full overflow-hidden rounded-full",
          world.locked ? "bg-white/70" : "bg-black/20",
        )}
      >
        <span
          aria-hidden="true"
          className="block h-full rounded-full bg-white transition-[width] duration-700 ease-out"
          style={{ width: `${pct}%`, backgroundColor: world.locked ? color.fill : undefined }}
        />
      </span>
      <span className="sr-only">{progressSr}</span>
    </>
  );
  const colorStyle: React.CSSProperties = world.locked
    ? { backgroundColor: `color-mix(in oklab, ${color.fill} 22%, white)`, boxShadow: `0 5px 0 color-mix(in oklab, ${color.fill} 35%, white)` }
    : { backgroundColor: color.fill, boxShadow: `0 6px 0 ${color.ledge}` };

  // Locked worlds are dimmed with a sunken surface, grayscale icon and a
  // lock badge — NOT opacity: the bb-cascade entrance animation ends at
  // opacity 1 with fill-mode both, which silently overrode `opacity-60` and
  // made every locked world look exactly as open as the first one.
  const shared = "bb-cascade flex flex-col rounded-2xl p-4";

  if (world.locked) {
    // Locked worlds are not links — there is nothing to open yet.
    return (
      <li
        className={shared}
        style={{ "--i": index, ...colorStyle } as React.CSSProperties}
      >
        {inner}
      </li>
    );
  }

  return (
    <li className="contents">
      <Link
        href="/adventure"
        className={cn(shared, "bb-pop transition-transform hover:-translate-y-0.5 active:translate-y-1")}
        style={{ "--i": index, ...colorStyle } as React.CSSProperties}
      >
        {inner}
      </Link>
    </li>
  );
}
