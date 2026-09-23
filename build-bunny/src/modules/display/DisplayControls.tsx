"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { Button, Dialog, cn, useDisplayPrefs, type TextSize } from "@/ui";

/**
 * Display settings for the student area: text size, high contrast, reduce
 * motion. Big targets, real switches, a segmented control for size whose
 * options are rendered AT their size so the choice is visible before it
 * is made.
 */

function Switch({
  checked,
  onChange,
  label,
  describedBy,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  describedBy?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      aria-describedby={describedBy}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-11 w-[4.25rem] shrink-0 items-center rounded-full border-2 transition-colors",
        checked ? "border-brand bg-brand" : "border-border-token bg-surface-sunken",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "absolute top-1/2 size-8 -translate-y-1/2 rounded-full bg-surface-raised shadow-soft transition-[inset-inline-start]",
          checked ? "start-[calc(100%-2.25rem)]" : "start-1",
        )}
      />
      <span
        aria-hidden="true"
        className={cn(
          "absolute top-1/2 -translate-y-1/2 text-xs font-bold",
          checked ? "start-2 text-on-brand" : "end-2 text-ink-muted",
        )}
      >
        {checked ? "✓" : "—"}
      </span>
    </button>
  );
}

const SIZES: { value: TextSize; className: string }[] = [
  { value: "normal", className: "text-base" },
  { value: "large", className: "text-lg" },
  { value: "xl", className: "text-xl" },
];

export function DisplaySettingsPanel() {
  const t = useTranslations("student.display");
  const { prefs, update } = useDisplayPrefs();
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-ink-muted">{t("intro")}</p>

      <fieldset className="flex flex-col gap-2 rounded-xl border border-border-token bg-surface-raised p-3">
        <legend className="sr-only">{t("textSize")}</legend>
        <span className="font-display text-base font-bold text-ink">{t("textSize")}</span>
        <div role="radiogroup" aria-label={t("textSize")} className="grid grid-cols-3 gap-2">
          {SIZES.map((size) => {
            const active = prefs.textSize === size.value;
            return (
              <button
                key={size.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => update((current) => ({ ...current, textSize: size.value }))}
                className={cn(
                  "flex min-h-14 items-center justify-center rounded-lg border-2 px-2 font-semibold transition-colors",
                  size.className,
                  active
                    ? "border-brand bg-brand/10 text-ink"
                    : "border-border-token bg-surface-sunken text-ink-muted hover:text-ink",
                )}
              >
                {t(`textSize_${size.value}`)}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="flex items-center gap-3 rounded-xl border border-border-token bg-surface-raised p-3">
        <span aria-hidden="true" className="text-2xl">
          🔆
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="font-display text-base font-bold text-ink">{t("contrast")}</span>
          <span id="display-contrast-hint" className="text-sm text-ink-muted">
            {t("contrastHint")}
          </span>
        </div>
        <Switch
          checked={prefs.contrast === "high"}
          onChange={(on) => update((c) => ({ ...c, contrast: on ? "high" : "normal" }))}
          label={t("contrast")}
          describedBy="display-contrast-hint"
        />
      </div>

      <div className="flex items-center gap-3 rounded-xl border border-border-token bg-surface-raised p-3">
        <span aria-hidden="true" className="text-2xl">
          🐢
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="font-display text-base font-bold text-ink">{t("motion")}</span>
          <span id="display-motion-hint" className="text-sm text-ink-muted">
            {t("motionHint")}
          </span>
        </div>
        <Switch
          checked={prefs.motion === "reduce"}
          onChange={(on) => update((c) => ({ ...c, motion: on ? "reduce" : "auto" }))}
          label={t("motion")}
          describedBy="display-motion-hint"
        />
      </div>
    </div>
  );
}

/** Sidebar entry that opens the display panel. */
export function DisplaySettingsButton({ className }: { className?: string }) {
  const t = useTranslations("student.display");
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className={cn(
          "inline-flex h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink",
          className,
        )}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="size-5 shrink-0"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 20h16M6 4h9l5 5v11" />
          <path d="M9 16h6M12 9v7" />
        </svg>
        {t("title")}
      </button>
      {open ? (
        <Dialog
          open
          onClose={() => setOpen(false)}
          title={t("title")}
          closeLabel={t("close")}
          footer={
            <Button size="lg" onClick={() => setOpen(false)}>
              {t("done")}
            </Button>
          }
        >
          <DisplaySettingsPanel />
        </Dialog>
      ) : null}
    </>
  );
}
