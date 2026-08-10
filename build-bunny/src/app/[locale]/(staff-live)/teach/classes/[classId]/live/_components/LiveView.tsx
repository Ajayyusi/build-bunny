"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { EmptyState } from "@/ui";

export interface LiveStudent {
  userId: string;
  displayName: string;
  currentLevelTitle: string | null;
  completed: boolean;
}

export interface LiveSnapshot {
  className: string;
  grade: number;
  completionPct: number;
  activeThisWeek: number;
  studentCount: number;
  students: LiveStudent[];
}

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
}: {
  classId: string;
  locale: string;
  initial: LiveSnapshot;
}) {
  const t = useTranslations("staff.teach.live");
  const [snapshot, setSnapshot] = useState(initial);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const response = await fetch(`/api/teach/classes/${classId}/live?locale=${locale}`, {
          cache: "no-store",
        });
        if (!response.ok || cancelled) return;
        const data = (await response.json()) as LiveSnapshot;
        if (!cancelled) setSnapshot(data);
      } catch {
        // Transient network hiccups just keep showing the last good snapshot.
      }
    };
    const id = window.setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [classId, locale]);

  return (
    <div className="flex min-h-dvh flex-col gap-8 px-8 py-10 sm:px-16">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-bold text-ink sm:text-5xl">
            {t("title", { className: snapshot.className })}
          </h1>
          <p className="mt-1 text-lg text-ink-muted">{t("refreshNote")}</p>
        </div>
        <Link
          href={`/teach/classes/${classId}`}
          className="rounded-md border border-border-token px-4 py-2 text-base font-semibold text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink"
        >
          {t("backLink")}
        </Link>
      </header>

      <div className="flex flex-wrap items-center gap-10">
        <CompletionRing pct={snapshot.completionPct} label={t("completionLabel")} />
        <div className="flex flex-col gap-1">
          <span className="font-display text-3xl font-bold tabular-nums text-ink">
            {snapshot.activeThisWeek}/{snapshot.studentCount}
          </span>
          <span className="text-lg text-ink-muted">{t("whoIsWhere")}</span>
        </div>
      </div>

      {snapshot.students.length === 0 ? (
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
