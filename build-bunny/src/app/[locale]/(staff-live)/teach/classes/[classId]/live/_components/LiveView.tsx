"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { EmptyState } from "@/ui";

import type { LiveSnapshot } from "@/modules/analytics/live";

export type { LiveSnapshot };

const POLL_MS = 20_000;
const RING_RADIUS = 80;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function CompletionRing({ pct, label }: { pct: number; label: string }) {
  const offset = RING_CIRCUMFERENCE * (1 - pct / 100);
  return (
    <div className="relative flex size-48 shrink-0 items-center justify-center">
      <svg viewBox="0 0 200 200" className="size-48 -rotate-90">
        <circle cx="100" cy="100" r={RING_RADIUS} strokeWidth="16" className="fill-none stroke-ink/10" />
        <circle
          cx="100"
          cy="100"
          r={RING_RADIUS}
          strokeWidth="16"
          strokeLinecap="round"
          className="fill-none stroke-brand transition-[stroke-dashoffset] duration-700"
          strokeDasharray={RING_CIRCUMFERENCE}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="font-display text-5xl font-bold tabular-nums text-ink">{pct}%</span>
        <span className="text-sm font-semibold text-ink-muted">{label}</span>
      </div>
    </div>
  );
}

export function LiveView({
  classId,
  locale,
  initial,
  initialShowNames = false,
}: {
  classId: string;
  locale: string;
  initial: LiveSnapshot;
  initialShowNames?: boolean;
}) {
  const t = useTranslations("staff.teach.live");
  const [snapshot, setSnapshot] = useState(initial);
  /**
   * Consecutive failed polls.
   *
   * Keeping the last good snapshot on a hiccup is right — a board that
   * blanked on one dropped packet would be useless in a classroom. What was
   * wrong is that it kept promising "Updates every 20 seconds" while doing
   * nothing of the kind, so a frozen board and a class where nobody happens
   * to be working look identical from across the room. A teacher reads that
   * as "they have all stopped".
   */
  const [failures, setFailures] = useState(0);
  // The lesson's challenge level: kept in the URL so a reload keeps it.
  const [challengeId, setChallengeId] = useState<string | null>(initial.challenge?.levelId ?? null);
  // A projector is a shared screen: names stay off until the teacher turns
  // them on, and that choice is kept in the URL like the challenge.
  const [showNames, setShowNames] = useState(initialShowNames);
  const hideNames = !showNames;
  // Only the latest challenge pick may update the board.
  const pickSeq = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const challenge = challengeId ? `&challenge=${encodeURIComponent(challengeId)}` : "";
        const response = await fetch(`/api/teach/classes/${classId}/live?locale=${locale}${challenge}`, {
          cache: "no-store",
        });
        if (cancelled) return;
        // A non-OK response is a failed refresh too: it used to return
        // quietly here, so a 500 from the API looked exactly like success.
        if (!response.ok) {
          setFailures((n) => n + 1);
          return;
        }
        const data = (await response.json()) as LiveSnapshot;
        if (!cancelled) {
          setSnapshot(data);
          setFailures(0);
        }
      } catch {
        if (!cancelled) setFailures((n) => n + 1);
      }
    };
    const id = window.setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [classId, locale, challengeId]);

  const toggleNames = () => {
    const next = !showNames;
    setShowNames(next);
    const url = new URL(window.location.href);
    if (next) url.searchParams.set("names", "1");
    else url.searchParams.delete("names");
    window.history.replaceState(null, "", url);
  };

  const pickChallenge = (levelId: string) => {
    const next = levelId || null;
    const seq = ++pickSeq.current;
    setChallengeId(next);
    const url = new URL(window.location.href);
    if (next) url.searchParams.set("challenge", next);
    else url.searchParams.delete("challenge");
    window.history.replaceState(null, "", url);
    // Show the new count straight away rather than after the next poll.
    void fetch(
      `/api/teach/classes/${classId}/live?locale=${locale}${next ? `&challenge=${encodeURIComponent(next)}` : ""}`,
      { cache: "no-store" },
    )
      .then((response) => (response.ok ? (response.json() as Promise<LiveSnapshot>) : null))
      .then((data) => {
        if (data && seq === pickSeq.current) setSnapshot(data);
      })
      .catch(() => {});
  };

  // Two consecutive misses (~40s) before saying anything: one dropped poll
  // on classroom wifi is normal and a banner that flickers would be worse
  // than no banner at all.
  const stale = failures >= 2;

  return (
    <div className="flex min-h-dvh flex-col gap-8 px-8 py-10 sm:px-16">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-bold text-ink sm:text-5xl">
            {t("title", { className: snapshot.className })}
          </h1>
          {/* Sized for a projector read from the back of a room: if the
              board has stopped updating, that has to be as visible as the
              data itself. */}
          {stale ? (
            <p
              role="status"
              className="mt-1 inline-flex items-center gap-2 rounded-lg bg-warning/20 px-3 py-1 text-lg font-bold text-ink"
            >
              <span aria-hidden="true">⚠</span>
              {t("staleNote")}
            </p>
          ) : (
            <p className="mt-1 text-lg text-ink-muted">{t("refreshNote")}</p>
          )}
        </div>
        <Link
          href={`/teach/classes/${classId}`}
          className="rounded-md border border-border-token px-4 py-2 text-base font-semibold text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink"
        >
          {t("backLink")}
        </Link>
      </header>

      <div className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1 text-base font-semibold text-ink">
          {t("challengePick")}
          <select
            value={challengeId ?? ""}
            onChange={(event) => pickChallenge(event.target.value)}
            className="h-12 min-w-64 rounded-md border border-border-token bg-surface-raised px-3 text-base text-ink"
          >
            <option value="">{t("challengeNone")}</option>
            {snapshot.levels.map((level) => (
              <option key={level.id} value={level.id}>
                {level.title}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          role="switch"
          aria-checked={showNames}
          onClick={toggleNames}
          className="h-12 rounded-md border border-border-token px-4 text-base font-semibold text-ink hover:bg-surface-sunken"
        >
          {t("showNames")}: {showNames ? t("on") : t("off")}
        </button>
      </div>

      {snapshot.challenge ? (
        <section
          aria-live="polite"
          className="flex flex-wrap items-center gap-6 rounded-2xl border-2 border-brand/40 bg-brand/5 px-8 py-6"
        >
          <span aria-hidden="true" className="text-5xl">🏁</span>
          <div className="flex flex-col">
            <span className="text-lg font-semibold text-ink-muted">{t("challengeHeading")}</span>
            <span className="font-display text-3xl font-bold text-ink">{snapshot.challenge.title}</span>
          </div>
          <span className="ms-auto font-display text-5xl font-bold tabular-nums text-ink">
            {t("challengeCount", { finished: snapshot.challenge.finished, total: snapshot.challenge.total })}
          </span>
        </section>
      ) : null}

      <div className="flex flex-wrap items-center gap-10">
        <CompletionRing pct={snapshot.completionPct} label={t("completionLabel")} />
        <div className="flex flex-col gap-1">
          <span className="font-display text-3xl font-bold tabular-nums text-ink">
            {snapshot.activeThisWeek}/{snapshot.studentCount}
          </span>
          <span className="text-lg text-ink-muted">{t("whoIsWhere")}</span>
        </div>
      </div>

      {hideNames ? null : snapshot.students.length === 0 ? (
        <EmptyState icon={<span className="text-3xl">🧑‍🎓</span>} title={t("emptyTitle")} />
      ) : (
        // aria-atomic="false": a 20s poll re-renders the whole list, but only
        // the cards whose text actually changed should be announced, not the
        // full roster every refresh (m5 §41: aria-live for auto-updating data).
        <ul
          aria-live="polite"
          aria-atomic="false"
          aria-label={t("liveRegionLabel")}
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
        >
          {snapshot.students.map((student) => (
            <li
              key={student.userId}
              className="flex flex-col gap-1 rounded-xl border border-border-token bg-surface-raised px-5 py-4"
            >
              <span className="font-display text-xl font-bold text-ink">{student.displayName}</span>
              <span className="text-base font-medium text-ink-muted">
                {student.completed ? (
                  <span className="inline-flex items-center gap-1 text-positive">
                    <span aria-hidden="true">✓</span> {t("completed")}
                  </span>
                ) : student.currentLevelTitle ? (
                  t("onLevel", { level: student.currentLevelTitle })
                ) : (
                  t("notStarted")
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
