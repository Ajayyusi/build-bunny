"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import {
  launchExploreActivityAction,
  setExploreActivityOpenAction,
  stopExploreLaunchAction,
} from "@/modules/explore/server/launch-actions";
import { Button, cn, runAction } from "@/ui";

export interface LaunchRowVM {
  slug: string;
  glyph: string;
  concept: string;
  title: string;
  open: boolean;
  launched: boolean;
}

/**
 * Activity launch control on a class page. The teacher switches each
 * Explore AI activity on or off for this class, and launches one: it is
 * pinned at the top of the class's Explore AI page as "Today's AI
 * activity" until they stop it or launch another.
 *
 * State is kept here after each save rather than read back through a
 * refresh: nothing else on the page depends on it.
 */
export function ExploreLaunchPanel({ classId, canManage, rows: initial }: { classId: string; canManage: boolean; rows: LaunchRowVM[] }) {
  const t = useTranslations("staff.teach.matrix.launch");
  const [rows, setRows] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState(false);

  const run = async (key: string, action: () => Promise<{ ok: boolean }>, apply: () => void) => {
    setBusy(key);
    setError(false);
    try {
      const result = await action();
      if (result.ok) apply();
      else setError(true);
    } finally {
      setBusy(null);
    }
  };

  const toggle = (row: LaunchRowVM) =>
    run(
      `open:${row.slug}`,
      () => runAction(() => setExploreActivityOpenAction({ classId, slug: row.slug, open: !row.open })),
      () =>
        setRows((current) =>
          current.map((r) => (r.slug === row.slug ? { ...r, open: !row.open, launched: row.open ? false : r.launched } : r)),
        ),
    );
  const launch = (row: LaunchRowVM) =>
    run(
      `launch:${row.slug}`,
      () => runAction(() => launchExploreActivityAction({ classId, slug: row.slug })),
      () => setRows((current) => current.map((r) => ({ ...r, launched: r.slug === row.slug, open: r.slug === row.slug ? true : r.open }))),
    );
  const stop = () =>
    run(
      "stop",
      () => runAction(() => stopExploreLaunchAction({ classId })),
      () => setRows((current) => current.map((r) => ({ ...r, launched: false }))),
    );

  const launched = rows.find((row) => row.launched);

  return (
    <div className="flex flex-col gap-3">
      <p role="status" className="text-sm text-ink">
        {launched ? t("launchedNow", { title: launched.title }) : t("noneLaunched")}
      </p>
      <ul className="flex flex-col gap-2">
        {rows.map((row) => (
          <li
            key={row.slug}
            className={cn(
              "flex flex-wrap items-center gap-3 rounded-lg px-3 py-2",
              row.launched ? "bg-brand/10 ring-1 ring-brand/40" : "bg-surface-sunken",
            )}
          >
            <span aria-hidden="true" className="text-xl">
              {row.glyph}
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-sm font-semibold text-ink">{row.title}</span>
              <span className="text-xs text-ink-muted">{row.concept}</span>
            </span>
            {canManage ? (
              <>
                <button
                  type="button"
                  role="switch"
                  aria-checked={row.open}
                  aria-label={t("openLabel", { title: row.title })}
                  disabled={busy !== null}
                  onClick={() => void toggle(row)}
                  className={cn(
                    "inline-flex h-10 items-center gap-2 rounded-full border px-3 text-sm font-semibold transition-colors disabled:opacity-60",
                    row.open ? "border-brand/40 bg-surface-raised text-ink" : "border-border-token bg-surface text-ink-muted",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn("inline-block size-3 rounded-full", row.open ? "bg-brand" : "bg-ink-faint")}
                  />
                  {row.open ? t("on") : t("off")}
                </button>
                {row.launched ? (
                  <Button size="md" variant="secondary" loading={busy === "stop"} disabled={busy !== null} onClick={() => void stop()}>
                    {t("stop")}
                  </Button>
                ) : (
                  <Button
                    size="md"
                    loading={busy === `launch:${row.slug}`}
                    disabled={busy !== null}
                    onClick={() => void launch(row)}
                    aria-label={t("launchLabel", { title: row.title })}
                  >
                    {t("launch")}
                  </Button>
                )}
              </>
            ) : (
              <span className="text-xs font-semibold text-ink-muted">
                {row.launched ? t("launchedBadge") : row.open ? t("on") : t("off")}
              </span>
            )}
          </li>
        ))}
      </ul>
      {error ? (
        <p role="alert" className="text-sm font-semibold text-danger">
          {t("error")}
        </p>
      ) : null}
    </div>
  );
}
