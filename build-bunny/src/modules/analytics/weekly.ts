import type { AiActivityCountsShape } from "./ai-concepts";

/**
 * Weekly AI activity for the school admin's trend (handoff: trends over
 * time). Weeks start on Monday, in UTC, like Postgres's date_trunc('week').
 * Pure: the reader groups the events by week and type; this zero-fills the
 * weeks nobody played and keeps them in order, oldest first.
 */

export interface WeekRow extends AiActivityCountsShape {
  /** Monday of the week, as YYYY-MM-DD (UTC). */
  weekStart: string;
}

export function mondayUtc(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = (d.getUTCDay() + 6) % 7; // Monday = 0
  d.setUTCDate(d.getUTCDate() - day);
  return d;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** The Mondays of the last `weeks` weeks, oldest first, ending with this week. */
export function weekStarts(now: Date, weeks: number): string[] {
  const thisWeek = mondayUtc(now);
  return Array.from({ length: weeks }, (_, i) => {
    const d = new Date(thisWeek);
    d.setUTCDate(d.getUTCDate() - 7 * (weeks - 1 - i));
    return iso(d);
  });
}

export function weeklySeries(
  rows: readonly { week: Date; type: string; n: number }[],
  now: Date,
  weeks: number,
): WeekRow[] {
  const series = new Map(
    weekStarts(now, weeks).map((weekStart) => [weekStart, { weekStart, starts: 0, tests: 0, retries: 0, completions: 0 }]),
  );
  for (const row of rows) {
    const entry = series.get(iso(mondayUtc(row.week)));
    if (!entry) continue;
    if (row.type === "LEVEL_SESSION_STARTED" || row.type === "LEVEL_STARTED") entry.starts += row.n;
    else if (row.type === "RUN_EXECUTED" || row.type === "AI_TEST") entry.tests += row.n;
    else if (row.type === "AI_RETRY") entry.retries += row.n;
    else if (row.type === "LEVEL_COMPLETED") entry.completions += row.n;
  }
  return [...series.values()];
}
