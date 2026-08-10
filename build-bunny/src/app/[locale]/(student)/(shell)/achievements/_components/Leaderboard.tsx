import type { LeaderboardRow } from "@/modules/students/server/queries";
import { Avatar, cn } from "@/ui";

interface LeaderboardProps {
  rows: LeaderboardRow[];
  title: string;
  hint: string;
  emptyText: string;
  youLabel: string;
  xpLabel: (value: number) => string;
}

/** Medal tint for the top three; everyone else gets the plain row treatment. */
const PODIUM_TINT = [
  "bg-accent/30 border-accent",
  "bg-surface-sunken border-border-token",
  "bg-warning/15 border-warning/40",
] as const;

export function Leaderboard({
  rows,
  title,
  hint,
  emptyText,
  youLabel,
  xpLabel,
}: LeaderboardProps) {
  const podium = rows.slice(0, 3);
  const rest = rows.slice(3, 8);

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-border-token bg-surface-raised p-5 shadow-soft">
      <div className="flex flex-col gap-0.5">
        <h2 className="font-display text-lg font-bold text-ink">{title}</h2>
        <p className="text-xs text-ink-muted">{hint}</p>
      </div>

      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-muted">{emptyText}</p>
      ) : (
        <>
          {/* Podium — reordered visually to 2·1·3 so first place sits centre
              and tallest, while the DOM keeps true rank order for AT. */}
          <ol className="grid grid-cols-3 items-end gap-2">
            {podium.map((row) => (
              <li
                key={row.userId}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center",
                  PODIUM_TINT[row.rank - 1],
                  row.rank === 1 && "order-2 pb-5",
                  row.rank === 2 && "order-1",
                  row.rank === 3 && "order-3",
                )}
              >
                <span className="relative">
                  <Avatar displayName={row.displayName} size="md" />
                  <span
                    aria-hidden="true"
                    className="absolute -bottom-1 -end-1 grid size-5 place-items-center rounded-full bg-ink text-[10px] font-bold text-surface-raised"
                  >
                    {row.rank}
                  </span>
                </span>
                <span className="line-clamp-1 text-xs font-bold text-ink">
                  {row.isMe ? youLabel : row.displayName}
                </span>
                <span className="text-[11px] font-bold tabular-nums text-ink-muted">
                  {xpLabel(row.xpTotal)}
                </span>
              </li>
            ))}
          </ol>

          {rest.length > 0 ? (
            <ol className="flex flex-col divide-y divide-border-token">
              {rest.map((row) => (
                <li
                  key={row.userId}
                  className={cn(
                    "flex items-center gap-3 py-2.5",
                    row.isMe && "font-bold",
                  )}
                >
                  <span className="w-5 shrink-0 text-xs font-bold tabular-nums text-ink-muted">
                    {row.rank}
                  </span>
                  <Avatar displayName={row.displayName} size="sm" />
                  <span className="min-w-0 flex-1 truncate text-sm text-ink">
                    {row.isMe ? youLabel : row.displayName}
                  </span>
                  <span className="shrink-0 text-xs font-bold tabular-nums text-ink-muted">
                    {xpLabel(row.xpTotal)}
                  </span>
                </li>
              ))}
            </ol>
          ) : null}
        </>
      )}
    </section>
  );
}
