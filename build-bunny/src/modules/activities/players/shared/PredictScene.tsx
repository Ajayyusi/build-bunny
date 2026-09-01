"use client";

import { useTranslations } from "next-intl";

/**
 * "How to play" for a code-prediction level: read the program, then pick the
 * answer that says what it does. The program is never run — that is the
 * point of the activity, and the scene shows no bunny moving for exactly
 * that reason.
 *
 * The three answers are blank bars, not words. A scene that showed readable
 * options would be teaching which one to pick; this teaches only that there
 * are options and you choose one.
 *
 * Wordless, and reduced-motion settles on the chosen answer already marked.
 */

const SCENE_CSS = `
@keyframes prs-scan{0%{transform:translateY(0)}30%{transform:translateY(11px)}60%,100%{transform:translateY(22px)}}
@keyframes prs-pick{0%,62%{background:var(--color-surface);border-color:var(--color-border)}
  70%,100%{background:color-mix(in srgb, var(--color-positive) 15%, transparent);border-color:var(--color-positive)}}
@keyframes prs-tap{0%,58%{opacity:0;transform:scale(.6)}66%{opacity:1;transform:scale(1)}
  86%{opacity:1}100%{opacity:0}}
@keyframes prs-tick{0%,70%{opacity:0;transform:scale(.4)}80%,100%{opacity:1;transform:scale(1)}}

.prs-scan{animation:prs-scan 5s ease-in-out infinite}
.prs-pick{animation:prs-pick 5s ease-out infinite}
.prs-tap{opacity:0;animation:prs-tap 5s ease-out infinite}
.prs-tick{animation:prs-tick 5s ease-out infinite}

@media (prefers-reduced-motion: reduce){
  .prs-scan,.prs-pick,.prs-tap,.prs-tick{animation:none !important}
  .prs-tap{opacity:0}
  .prs-tick{opacity:1;transform:scale(1)}
  .prs-pick{background:color-mix(in srgb, var(--color-positive) 15%, transparent);
    border-color:var(--color-positive)}
}
`;

export function PredictScene() {
  const t = useTranslations("student.play.intro");

  return (
    <div
      dir="ltr"
      role="img"
      aria-label={t("predictSceneLabel")}
      className="flex items-center justify-center gap-5 rounded-xl bg-surface-sunken p-4"
    >
      <style>{SCENE_CSS}</style>

      {/* The program, being read — a marker travels down the lines. */}
      <div className="relative flex flex-col gap-2 rounded-md bg-ink/5 p-2">
        {[28, 20, 24].map((w, i) => (
          <span
            key={i}
            aria-hidden="true"
            className="h-1.5 rounded-full bg-ink/30"
            style={{ width: w * 2 }}
          />
        ))}
        <span
          aria-hidden="true"
          className="prs-scan absolute left-1 top-2 h-1.5 w-1 rounded-full bg-brand"
        />
      </div>

      {/* The answers. Blank on purpose: the scene must not say which. */}
      <div className="relative flex flex-col gap-1.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            aria-hidden="true"
            className={`h-6 w-24 rounded-full border bg-surface ${i === 1 ? "prs-pick" : "border-border-token"}`}
          />
        ))}
        <span
          aria-hidden="true"
          className="prs-tap pointer-events-none absolute text-base"
          style={{ left: 78, top: 26 }}
        >
          👆
        </span>
      </div>

      <span aria-hidden="true" className="prs-tick text-2xl">
        ✅
      </span>
    </div>
  );
}
