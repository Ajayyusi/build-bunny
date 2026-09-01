"use client";

import { useTranslations } from "next-intl";

/**
 * "How to play" for the privacy story: someone asks you something, you pick
 * what you would do, and the story carries on from there.
 *
 * The one thing this scene must not contain is a red cross. Grading here is
 * completion-based and the player never shows a failure banner — there are
 * no wrong feelings, and a child who thinks they are being marked will pick
 * the answer they think is wanted instead of the one they mean. So the
 * chosen option is simply carried forward into the next card, and nothing
 * is ever marked right.
 *
 * Wordless; reduced-motion settles with the choice made and the next card
 * already showing.
 */

const SCENE_CSS = `
@keyframes ets-tap{0%,24%{opacity:0;transform:scale(.6)}32%{opacity:1;transform:scale(1)}
  52%{opacity:1}62%,100%{opacity:0}}
@keyframes ets-chosen{0%,28%{background:var(--color-surface);border-color:var(--color-border)}
  38%,100%{background:color-mix(in srgb, var(--color-brand) 14%, transparent);
    border-color:var(--color-brand)}}
@keyframes ets-fade{0%,40%{opacity:.25}56%,100%{opacity:1}}
@keyframes ets-arrow{0%,40%{opacity:0;transform:translateX(-6px)}56%,100%{opacity:1;transform:none}}

.ets-tap{opacity:0;animation:ets-tap 5s ease-out infinite}
.ets-chosen{animation:ets-chosen 5s ease-out infinite}
.ets-fade{animation:ets-fade 5s ease-out infinite}
.ets-arrow{animation:ets-arrow 5s ease-out infinite}

@media (prefers-reduced-motion: reduce){
  .ets-tap,.ets-chosen,.ets-fade,.ets-arrow{animation:none !important}
  .ets-tap{opacity:0}
  .ets-fade,.ets-arrow{opacity:1;transform:none}
  .ets-chosen{background:color-mix(in srgb, var(--color-brand) 14%, transparent);
    border-color:var(--color-brand)}
}
`;

function Bars({ widths }: { widths: number[] }) {
  return (
    <div className="flex flex-col gap-1">
      {widths.map((w, i) => (
        <span
          key={i}
          aria-hidden="true"
          className="h-1.5 rounded-full bg-ink/25"
          style={{ width: w }}
        />
      ))}
    </div>
  );
}

export function EthicsScene() {
  const t = useTranslations("student.play.intro");

  return (
    <div
      dir="ltr"
      role="img"
      aria-label={t("ethicsSceneLabel")}
      className="flex items-center justify-center gap-3 rounded-xl bg-surface-sunken p-4"
    >
      <style>{SCENE_CSS}</style>

      {/* The question, and two ways to answer it. Neither is marked. */}
      <div className="relative flex flex-col gap-2 rounded-lg border border-border-token bg-surface p-2.5">
        <Bars widths={[64, 44]} />
        <span
          aria-hidden="true"
          className="ets-chosen h-5 w-24 rounded-full border border-border-token bg-surface"
        />
        <span
          aria-hidden="true"
          className="h-5 w-24 rounded-full border border-border-token bg-surface"
        />
        <span
          aria-hidden="true"
          className="ets-tap pointer-events-none absolute text-base"
          style={{ left: 78, top: 24 }}
        >
          👆
        </span>
      </div>

      <span aria-hidden="true" className="ets-arrow text-lg text-ink-muted">
        →
      </span>

      {/* The story carries on. */}
      <div className="ets-fade flex flex-col gap-2 rounded-lg border border-border-token bg-surface p-2.5">
        <Bars widths={[56, 40, 48]} />
      </div>
    </div>
  );
}
