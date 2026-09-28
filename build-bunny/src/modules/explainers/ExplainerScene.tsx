"use client";

import { useTranslations } from "next-intl";

import { cn } from "@/ui";

import type { Colour, ExplainerScene as Scene, Tone } from "./scripts";

/**
 * The picture for one explainer beat. Decorative (aria-hidden): the caption
 * says everything the picture shows, so the explainer works with the
 * picture, the sound, or neither — captions alone carry it.
 */

const FILL: Record<Colour, string> = { red: "#dc2626", orange: "#f97316" };
const BIRD: Record<Tone, string> = { light: "#f1dfc0", dark: "#57534e" };

function Mark({ mark }: { mark: "right" | "wrong" | "new" }) {
  const t = useTranslations("explainers.scene");
  return (
    <span
      className={cn(
        "absolute -end-2 -top-2 rounded-full px-1.5 py-0.5 text-[10px] font-bold",
        mark === "wrong" ? "bg-danger text-surface-raised" : mark === "new" ? "bg-accent text-ink" : "bg-brand text-surface-raised",
      )}
    >
      {mark === "wrong" ? `✗ ${t("wrong")}` : mark === "new" ? t("newOne") : "✓"}
    </span>
  );
}

function Bird({ tone }: { tone: Tone }) {
  return (
    <svg viewBox="0 0 40 32" className="h-8 w-10">
      <path d="M4 20 Q10 8 24 10 Q34 11 36 18 Q30 26 18 26 Q8 26 4 20 Z" fill={BIRD[tone]} stroke="#1f2937" strokeWidth="1.5" />
      <circle cx="29" cy="15" r="1.6" fill="#1f2937" />
      <path d="M35 16 L39 17 L35 18 Z" fill="#64748b" />
    </svg>
  );
}

export function ExplainerSceneView({ scene }: { scene: Scene }) {
  const t = useTranslations("explainers.scene");
  if (scene.kind === "shapes") {
    return (
      <div aria-hidden="true" className="flex flex-wrap items-end justify-center gap-4 p-4">
        {scene.items.map((item, i) => (
          <span key={i} className={cn("relative", item.mark && "ms-4")}>
            {item.shape === "circle" ? (
              <span className="block size-12 rounded-full border-2 border-ink/70" style={{ background: FILL[item.colour] }} />
            ) : (
              <span className="block size-12 rounded-md border-2 border-ink/70" style={{ background: FILL[item.colour] }} />
            )}
            {item.mark ? <Mark mark={item.mark} /> : null}
          </span>
        ))}
      </div>
    );
  }
  if (scene.kind === "birds") {
    return (
      <div aria-hidden="true" className="flex flex-wrap items-center justify-center gap-4 p-4">
        <div className="flex flex-col items-center gap-1 rounded-xl border border-border-token bg-surface p-2">
          <span className="text-xs font-bold text-ink-muted">{t("trainedOn")}</span>
          <div className="grid grid-cols-5 gap-1">
            {Array.from({ length: scene.trained.light }, (_, i) => <Bird key={`l${i}`} tone="light" />)}
            {Array.from({ length: scene.trained.dark }, (_, i) => <Bird key={`d${i}`} tone="dark" />)}
          </div>
        </div>
        {scene.newBird ? (
          <span className="relative rounded-xl border-2 border-dashed border-ink/30 p-3">
            <Bird tone={scene.newBird.tone} />
            <Mark mark={scene.newBird.mark} />
          </span>
        ) : null}
      </div>
    );
  }
  return (
    <div aria-hidden="true" className="flex flex-wrap items-center justify-center gap-3 p-4">
      {scene.show.includes("chat") ? (
        <span className="max-w-48 rounded-2xl rounded-es-sm bg-info/15 px-3 py-2 text-sm font-semibold text-ink">
          <span className="me-1">🤖</span>
          {t("chat")}
        </span>
      ) : null}
      {scene.show.includes("timetable") ? (
        <span className="max-w-52 rounded-lg border-2 border-ink/20 bg-surface-raised px-3 py-2 text-sm text-ink">
          <span className="me-1">📅</span>
          {t("timetable")}
        </span>
      ) : null}
      {scene.show.includes("check") ? (
        <span className="rounded-full bg-brand/15 px-3 py-1 text-sm font-bold text-brand">✓ {t("checked")}</span>
      ) : null}
    </div>
  );
}
