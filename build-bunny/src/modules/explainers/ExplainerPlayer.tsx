"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useLocale, useTranslations } from "next-intl";

import { Button, Dialog, cn, useReducedMotion, useSound } from "@/ui";
import { Character } from "@/modules/characters/Character";

import { ExplainerSceneView } from "./ExplainerScene";
import { beatIndexAt, explainerById } from "./scripts";

const TICK_MS = 200;

/**
 * Plays one explainer: timed, captioned beats, then the interactive choice
 * it ends on (handoff: 20-40 s, then straight into interaction; never
 * required; captions, mute, keyboard, reduced motion).
 *
 *  - Captions are on by default and can be turned off; they are the one
 *    channel that always carries everything.
 *  - Narration reads each caption aloud only when the child's voice setting
 *    is on, and has its own off switch here (the mute control).
 *  - Under reduced motion nothing moves and nothing advances by itself:
 *    the child steps through the parts with Next.
 *  - Keyboard: Space plays or pauses, the arrow keys move between parts,
 *    Escape closes (the dialog's own).
 *  - "Skip to the activity" is always there: the lesson never depends on it.
 */
export function ExplainerPlayer({ explainerId, open, onClose }: { explainerId: string; open: boolean; onClose: () => void }) {
  const explainer = explainerById(explainerId);
  const t = useTranslations("explainers");
  const tUi = useTranslations("explainers.ui");
  const locale = useLocale();
  const reduced = useReducedMotion();
  const { prefs, narrate, stopNarration, narrationAvailable } = useSound();
  const voiceAllowed = prefs.voice.on && !prefs.muted && narrationAvailable;

  const [elapsed, setElapsed] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [ended, setEnded] = useState(false);
  const [captions, setCaptions] = useState(true);
  const [narration, setNarration] = useState(true);
  const [picked, setPicked] = useState<string | null>(null);

  // Opening starts from the top; it plays by itself unless motion is reduced.
  useEffect(() => {
    if (!open) return;
    setElapsed(0);
    setEnded(false);
    setPicked(null);
    setPlaying(!reduced);
  }, [open, reduced]);

  useEffect(() => {
    if (!open || !playing || !explainer) return;
    const timer = window.setInterval(() => {
      setElapsed((ms) => {
        const next = ms + TICK_MS;
        if (next >= explainer.durationMs) {
          setPlaying(false);
          setEnded(true);
          return explainer.durationMs;
        }
        return next;
      });
    }, TICK_MS);
    return () => window.clearInterval(timer);
  }, [open, playing, explainer]);

  const index = explainer ? beatIndexAt(explainer, elapsed) : 0;
  const caption = explainer ? t(`${explainer.id}.beats.${index}`) : "";

  // Narration follows the caption, and stops when it's switched off or closed.
  const spoken = useRef<string | null>(null);
  useEffect(() => {
    if (!open || ended || !voiceAllowed || !narration) {
      if (spoken.current !== null) stopNarration();
      spoken.current = null;
      return;
    }
    if (spoken.current === caption) return;
    spoken.current = caption;
    narrate(caption);
  }, [open, ended, voiceAllowed, narration, caption, narrate, stopNarration]);
  useEffect(() => () => stopNarration(), [stopNarration]);

  if (!explainer) return null;
  const beat = explainer.beats[index]!;
  const total = explainer.beats.length;

  const goTo = (i: number) => {
    if (i >= total) {
      setPlaying(false);
      setEnded(true);
      return;
    }
    setEnded(false);
    setElapsed(explainer.beats[Math.max(0, i)]!.atMs);
  };
  const restart = () => {
    setEnded(false);
    setPicked(null);
    setElapsed(0);
    setPlaying(!reduced);
  };

  const rtl = locale === "ar";
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (ended) return;
    const target = event.target as HTMLElement;
    if (event.key === " " && target.tagName !== "BUTTON") {
      event.preventDefault();
      setPlaying((p) => !p);
    } else if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      const forward = (event.key === "ArrowRight") !== rtl;
      goTo(index + (forward ? 1 : -1));
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title={t(`${explainer.id}.title`)} size="lg">
      <div className="flex flex-col gap-3" onKeyDown={onKeyDown} data-explainer={explainer.id}>
        {!ended ? (
          <>
            <div className="relative flex min-h-44 flex-col items-center justify-center gap-2 rounded-xl bg-surface-sunken">
              <ExplainerSceneView scene={beat.scene} />
              <div className="absolute bottom-2 start-2">
                <Character id={beat.character} state={beat.state} size="md" />
              </div>
            </div>
            {/* Captions: the channel that always carries the whole explainer. */}
            <p aria-live="polite" className={cn("min-h-12 rounded-lg bg-ink/90 px-3 py-2 text-base font-semibold text-surface-raised", !captions && "sr-only")}>
              {caption}
            </p>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken" aria-hidden="true">
              <div className="h-full bg-brand" style={{ width: `${Math.min(100, (elapsed / explainer.durationMs) * 100)}%` }} />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="lg" variant="secondary" onClick={() => setPlaying((p) => !p)}>
                {playing ? tUi("pause") : tUi("play")}
              </Button>
              <Button size="lg" variant="ghost" onClick={() => goTo(index - 1)} disabled={index === 0}>
                {tUi("previous")}
              </Button>
              <Button size="lg" variant="ghost" onClick={() => goTo(index + 1)}>
                {tUi("next")}
              </Button>
              <span className="text-xs text-ink-muted">{tUi("part", { current: index + 1, total })}</span>
              <span className="ms-auto flex flex-wrap gap-2">
                <Button size="lg" variant="ghost" aria-pressed={captions} onClick={() => setCaptions((c) => !c)}>
                  {captions ? tUi("captionsOn") : tUi("captionsOff")}
                </Button>
                {voiceAllowed ? (
                  <Button size="lg" variant="ghost" aria-pressed={narration} onClick={() => setNarration((n) => !n)}>
                    {narration ? tUi("soundOn") : tUi("soundOff")}
                  </Button>
                ) : null}
              </span>
            </div>
            <p className="text-xs text-ink-muted">{tUi("keys")}</p>
            <div className="flex justify-end">
              <Button size="lg" variant="ghost" onClick={onClose}>
                {tUi("skip")}
              </Button>
            </div>
          </>
        ) : (
          // The ending: a choice, not a lecture — then straight into the activity.
          <div className="flex flex-col gap-3">
            <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">{tUi("yourTurn")}</p>
            <h3 id={`${explainer.id}-choice`} className="font-display text-lg font-bold text-ink">
              {t(`${explainer.id}.choice.question`)}
            </h3>
            <div role="radiogroup" aria-labelledby={`${explainer.id}-choice`} className="flex flex-col gap-2">
              {explainer.choice.options.map((option) => (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={picked === option}
                  onClick={() => setPicked(option)}
                  className={cn(
                    "min-h-11 rounded-xl border-2 px-3 py-2 text-start text-sm font-semibold text-ink transition-colors",
                    picked === option ? "border-brand bg-brand/10" : "border-border-token bg-surface-raised hover:bg-surface-sunken",
                  )}
                >
                  {t(`${explainer.id}.choice.options.${option}`)}
                </button>
              ))}
            </div>
            {picked ? (
              <p role="status" className={cn("rounded-lg px-3 py-2 text-sm font-semibold", picked === explainer.choice.best ? "bg-brand/15 text-brand" : "bg-accent/20 text-ink")}>
                {t(`${explainer.id}.choice.replies.${picked}`)}
              </p>
            ) : null}
            <div className="flex flex-wrap justify-end gap-2">
              <Button size="lg" variant="ghost" onClick={restart}>
                {tUi("restart")}
              </Button>
              <Button size="lg" onClick={onClose}>{tUi("start")}</Button>
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
}

/** The offer on a level's briefing: optional, and labelled so. */
export function ExplainerOffer({ explainerId, className }: { explainerId: string; className?: string }) {
  const explainer = explainerById(explainerId);
  const tUi = useTranslations("explainers.ui");
  const [open, setOpen] = useState(false);
  if (!explainer) return null;
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <Button size="lg" variant="secondary" onClick={() => setOpen(true)}>
        <span aria-hidden="true">▶</span> {tUi("watch", { seconds: Math.round(explainer.durationMs / 1000) })}
      </Button>
      <span className="text-xs text-ink-muted">{tUi("optional")}</span>
      <ExplainerPlayer explainerId={explainerId} open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
