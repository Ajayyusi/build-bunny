import { Link } from "@/i18n/navigation";
import { cn, worldColor } from "@/ui";

export interface ExploreTileVM {
  levelId: string;
  glyph: string;
  worldTheme: string;
  conceptName: string;
  title: string;
  hook: string;
  state: "LOCKED" | "UNLOCKED" | "IN_PROGRESS" | "COMPLETED";
  stars: number;
  maxStars: number;
  statusLabel: string;
  minutesLabel: string;
  starsSr: string;
  /** "Explained" when the child answered the quick check; null otherwise. */
  explainedLabel: string | null;
  /** Shown instead of a link while the level is still closed. */
  lockedLabel?: string;
}

/**
 * One Explore AI card. It takes its world's Toy Box colour, so the card and
 * the level it opens look like the same place. The whole card is the link;
 * a closed one is a plain tile with a note saying what opens it.
 */
export function ExploreTile({
  tile,
  index,
  compact = false,
}: {
  tile: ExploreTileVM;
  index: number;
  compact?: boolean;
}) {
  const color = worldColor(tile.worldTheme);
  const locked = tile.state === "LOCKED";
  const done = tile.state === "COMPLETED";

  const body = (
    <>
      <span
        className={cn("relative flex items-start justify-between gap-2 rounded-t-2xl px-4", compact ? "py-3" : "py-4")}
        style={{ backgroundColor: locked ? `color-mix(in oklab, ${color.fill} 22%, white)` : color.fill }}
      >
        <span
          aria-hidden="true"
          className={cn(
            "grid place-items-center rounded-2xl",
            compact ? "size-11 text-2xl" : "size-14 text-3xl",
            locked ? "bg-white/70 grayscale" : "bg-white/25",
          )}
        >
          {tile.glyph}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-bold text-ink">
          <span aria-hidden="true">{locked ? "🔒" : done ? "✓" : tile.state === "IN_PROGRESS" ? "▶" : "✨"}</span>
          {tile.statusLabel}
        </span>
      </span>
      <span className={cn("flex flex-1 flex-col gap-1 px-4", compact ? "pb-3 pt-2" : "pb-4 pt-3")}>
        <span className="text-xs font-bold uppercase tracking-wide text-ink-muted">{tile.conceptName}</span>
        <span className={cn("font-display font-extrabold text-ink", compact ? "text-base" : "text-lg")}>{tile.title}</span>
        <span className={cn("text-sm text-ink-muted", compact && "line-clamp-2")}>{tile.hook}</span>
        <span className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-2 text-xs font-semibold text-ink-muted">
          <span>
            <span aria-hidden="true">🕒 </span>
            {tile.minutesLabel}
          </span>
          {done ? (
            <span>
              <span aria-hidden="true" className="tracking-tight" style={{ color: "var(--bb-toy-sun-strong)" }}>
                {"★".repeat(tile.stars)}
                <span className="text-ink/25">{"★".repeat(Math.max(0, tile.maxStars - tile.stars))}</span>
              </span>
              <span className="sr-only">{tile.starsSr}</span>
            </span>
          ) : null}
          {tile.explainedLabel ? (
            <span className="inline-flex items-center gap-1 text-positive">
              <span aria-hidden="true">💡</span>
              {tile.explainedLabel}
            </span>
          ) : null}
          {locked && tile.lockedLabel ? <span>{tile.lockedLabel}</span> : null}
        </span>
      </span>
    </>
  );

  const shared = "bb-cascade flex h-full flex-col overflow-hidden rounded-2xl border-2 bg-surface-raised";
  const style = {
    "--i": index,
    borderColor: `color-mix(in oklab, ${color.fill} 35%, white)`,
    boxShadow: locked ? undefined : `0 5px 0 color-mix(in oklab, ${color.fill} 45%, white)`,
  } as React.CSSProperties;

  if (locked) {
    return (
      <li className={shared} style={style}>
        {body}
      </li>
    );
  }
  return (
    <li className="contents">
      <Link
        href={`/play/${tile.levelId}`}
        className={cn(shared, "bb-pop transition-transform hover:-translate-y-0.5 active:translate-y-1")}
        style={style}
      >
        {body}
      </Link>
    </li>
  );
}
