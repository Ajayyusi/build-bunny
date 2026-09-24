"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { BunnyMascot, Button, cn, useFocusTrap, useSound, type BunnyState } from "@/ui";

import styles from "../../home/_components/onboarding.module.css";
import type { TrailWorldVM } from "./types";

/**
 * A world's opening scene: Robo Bunny tells the child, in three lines, what
 * is wrong in this world and who they will meet (docs/build-bunny/STORY.md).
 *
 * Shown automatically the first time a world is open on this device for
 * this child (the map is where a new world visibly opens), replayable from
 * the "Story" button on the world card, and skippable at every line — a
 * child who skips loses nothing they need to play.
 *
 * Seen-state lives in localStorage keyed by child + world, like the
 * welcome: it is a per-device UI memory, not learning progress.
 */

const STORAGE_VERSION = "v1";
const seenKey = (userId: string, slug: string) => `bb:worldintro:${STORAGE_VERSION}:${userId}:${slug}`;

export interface WorldIntroBeat {
  pose: BunnyState;
  text: string;
}

interface WorldIntroProps {
  worlds: TrailWorldVM[];
  userId: string;
  /** Slug of a world to replay on demand (null = auto-pick unseen). */
  replaySlug: string | null;
  onReplayDone: () => void;
}

function firstUnseen(worlds: TrailWorldVM[], userId: string): TrailWorldVM | null {
  for (const world of worlds) {
    if (world.state === "LOCKED" || !world.story || world.story.length === 0) continue;
    try {
      if (window.localStorage.getItem(seenKey(userId, world.slug)) === "1") continue;
    } catch {
      // Storage unavailable — show it; dismissing won't persist.
    }
    // Only the world the child is actually in (or the newest open one) —
    // never a queue of scenes for worlds finished long ago.
    if (world.state === "CURRENT" || world.state === "AVAILABLE") return world;
  }
  return null;
}

export function WorldIntro({ worlds, userId, replaySlug, onReplayDone }: WorldIntroProps) {
  const t = useTranslations("student.adventure.story");
  const { play, narrate, stopNarration, prefs } = useSound();
  const [world, setWorld] = useState<TrailWorldVM | null>(null);
  const [beat, setBeat] = useState(0);
  const dialogRef = useFocusTrap<HTMLDivElement>(world !== null, beat);

  useEffect(() => {
    if (replaySlug) {
      const target = worlds.find((w) => w.slug === replaySlug) ?? null;
      setWorld(target);
      setBeat(0);
      return;
    }
    const next = firstUnseen(worlds, userId);
    if (next) {
      setWorld(next);
      setBeat(0);
    }
  }, [worlds, userId, replaySlug]);

  const beats = world?.story ?? [];
  const current = beats[beat];

  // Narrate each line as it appears (only when the child has voice on).
  useEffect(() => {
    if (!current || !prefs.voice.on || prefs.muted) return;
    narrate(current.text);
    return () => stopNarration();
  }, [current, prefs.voice.on, prefs.muted, narrate, stopNarration]);

  useEffect(() => {
    if (world) play("whoosh");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per scene
  }, [world?.slug]);

  if (!world || !current) return null;

  const close = () => {
    try {
      window.localStorage.setItem(seenKey(userId, world.slug), "1");
    } catch {
      // Fine — it just shows again next time.
    }
    setWorld(null);
    if (replaySlug) onReplayDone();
  };

  const last = beat === beats.length - 1;

  return (
    <div
      className={cn(
        styles.scrim,
        "fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-ink/45 p-4",
      )}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={t("title", { world: world.name })}
        tabIndex={-1}
        data-world-theme={world.theme}
        className={cn(
          styles.card,
          "flex w-full max-w-md flex-col gap-4 rounded-2xl border border-border-token bg-surface-raised p-6 shadow-overlay focus:outline-none",
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="rounded-full bg-brand px-3 py-1 text-xs font-bold tracking-wide text-on-brand">
            {world.name}
          </span>
          {world.character ? (
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-muted">
              <span aria-hidden="true">{world.character.glyph}</span>
              {world.character.name}
            </span>
          ) : null}
        </div>

        <div className="flex items-end gap-3">
          <BunnyMascot state={current.pose} size="md" className="shrink-0" />
          <p
            key={beat}
            aria-live="polite"
            className="relative flex-1 rounded-2xl rounded-es-sm border border-border-token bg-surface-sunken px-4 py-3 text-base leading-relaxed text-ink"
          >
            {current.text}
          </p>
        </div>

        <div aria-hidden="true" className="flex items-center justify-center gap-1.5">
          {beats.map((_, index) => (
            <span
              key={index}
              className={cn(
                "size-2 rounded-full transition-colors",
                index === beat ? "bg-brand" : "bg-border-token",
              )}
            />
          ))}
        </div>

        <div className="flex items-center justify-between gap-2 pt-1">
          <Button variant="ghost" size="lg" onClick={close}>
            {t("skip")}
          </Button>
          <Button size="lg" data-autofocus onClick={() => (last ? close() : setBeat(beat + 1))}>
            {last ? t("go") : t("next")}
          </Button>
        </div>
      </div>
    </div>
  );
}
