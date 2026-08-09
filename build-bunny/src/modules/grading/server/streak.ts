import "server-only";

import type { Prisma } from "@prisma/client";

/**
 * School-day streaks (m3 adjudication): Mon–Fri by default, overridable per
 * school via School.weekStructure JSON {days:[1..7]} (ISO weekday, 1 = Mon).
 * All date math happens on calendar dates in the SCHOOL's timezone; a streak
 * increments when the previous school day had activity and a weekend (or any
 * non-school-day) gap between two active school days never breaks it.
 * No cron: everything updates transactionally on the activity itself.
 */

/** ISO weekdays (1 = Monday … 7 = Sunday). */
const DEFAULT_SCHOOL_DAYS = [1, 2, 3, 4, 5];

/** Parse School.weekStructure; missing/malformed → Mon–Fri. */
export function schoolDaysFrom(weekStructure: unknown): Set<number> {
  if (weekStructure && typeof weekStructure === "object" && !Array.isArray(weekStructure)) {
    const days = (weekStructure as { days?: unknown }).days;
    if (Array.isArray(days)) {
      const valid = days.filter(
        (d): d is number => typeof d === "number" && Number.isInteger(d) && d >= 1 && d <= 7,
      );
      if (valid.length > 0) return new Set(valid);
    }
  }
  return new Set(DEFAULT_SCHOOL_DAYS);
}

/** Calendar date key (YYYY-MM-DD) of an instant in the given IANA timezone. */
export function localDateKey(instant: Date, timeZone: string): string {
  // en-CA formats as YYYY-MM-DD directly.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

/** A date key as a UTC Date — the canonical value stored in @db.Date columns. */
export function dateKeyToUtcDate(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00.000Z`);
}

/** ISO weekday (1 = Mon … 7 = Sun) of a YYYY-MM-DD date key. */
export function isoWeekday(dateKey: string): number {
  const day = dateKeyToUtcDate(dateKey).getUTCDay(); // 0 = Sun … 6 = Sat
  return day === 0 ? 7 : day;
}

export function isSchoolDay(dateKey: string, schoolDays: Set<number>): boolean {
  return schoolDays.has(isoWeekday(dateKey));
}

function addDays(dateKey: string, days: number): string {
  const date = dateKeyToUtcDate(dateKey);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * The closest school day strictly before dateKey. With at least one school
 * day per week the walk terminates within 7 steps; a degenerate empty set
 * (never produced by schoolDaysFrom) returns yesterday.
 */
export function previousSchoolDay(dateKey: string, schoolDays: Set<number>): string {
  let cursor = addDays(dateKey, -1);
  for (let i = 0; i < 7; i += 1) {
    if (schoolDays.has(isoWeekday(cursor))) return cursor;
    cursor = addDays(cursor, -1);
  }
  return addDays(dateKey, -1);
}

export interface DailyActivityInput {
  studentUserId: string;
  schoolId: string;
  /** School timezone (IANA), e.g. "Asia/Dubai". */
  timeZone: string;
  /** School.weekStructure JSON (null = Mon–Fri). */
  weekStructure: unknown;
  /** The activity instant — injectable so tests can simulate calendar days. */
  now: Date;
  runsDelta?: number;
  completionsDelta?: number;
  xpDelta?: number;
}

export interface StreakOutcome {
  streakCurrent: number;
  streakBest: number;
  /** Date key (school-timezone calendar day) the activity was recorded on. */
  activityDate: string;
}

/**
 * Record one activity: upsert the StudentDailyActivity row for today (school
 * timezone) and update the profile's streak fields. Streak semantics:
 *  - first activity on a school day → +1 if the previous school day has an
 *    activity row, else reset to 1;
 *  - repeat activity on an already-active day → counters accumulate, streak
 *    unchanged;
 *  - activity on a NON-school day (weekend catch-up) → recorded for
 *    analytics, streak untouched in either direction.
 * Runs inside the caller's transaction. Exposed directly (with injectable
 * `now`) so tests can simulate multi-day timelines without clock mocking.
 */
export async function applyDailyActivity(
  tx: Prisma.TransactionClient,
  input: DailyActivityInput,
): Promise<StreakOutcome> {
  const todayKey = localDateKey(input.now, input.timeZone);
  const today = dateKeyToUtcDate(todayKey);
  const schoolDays = schoolDaysFrom(input.weekStructure);

  const existing = await tx.studentDailyActivity.findUnique({
    where: {
      studentUserId_date: { studentUserId: input.studentUserId, date: today },
    },
    select: { id: true },
  });

  if (existing) {
    await tx.studentDailyActivity.update({
      where: { id: existing.id },
      data: {
        runs: { increment: input.runsDelta ?? 0 },
        completions: { increment: input.completionsDelta ?? 0 },
        xp: { increment: input.xpDelta ?? 0 },
      },
    });
  } else {
    await tx.studentDailyActivity.create({
      data: {
        schoolId: input.schoolId,
        studentUserId: input.studentUserId,
        date: today,
        runs: input.runsDelta ?? 0,
        completions: input.completionsDelta ?? 0,
        xp: input.xpDelta ?? 0,
      },
    });
  }

  const profile = await tx.studentProfile.findUnique({
    where: { userId: input.studentUserId },
    select: { streakCurrent: true, streakBest: true },
  });
  let streakCurrent = profile?.streakCurrent ?? 0;
  let streakBest = profile?.streakBest ?? 0;

  // Streak moves only on the FIRST activity of a school day.
  if (!existing && isSchoolDay(todayKey, schoolDays)) {
    const prevKey = previousSchoolDay(todayKey, schoolDays);
    const prevActive = await tx.studentDailyActivity.findUnique({
      where: {
        studentUserId_date: {
          studentUserId: input.studentUserId,
          date: dateKeyToUtcDate(prevKey),
        },
      },
      select: { id: true },
    });
    streakCurrent = prevActive ? streakCurrent + 1 : 1;
    streakBest = Math.max(streakBest, streakCurrent);
  }

  if (profile) {
    await tx.studentProfile.update({
      where: { userId: input.studentUserId },
      data: { streakCurrent, streakBest, lastActiveDate: today },
    });
  }

  return { streakCurrent, streakBest, activityDate: todayKey };
}
