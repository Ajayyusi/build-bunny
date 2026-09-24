"use client";

import { useEffect, useRef } from "react";

import { trackForTheme, useMusicScene, useSound, type TrackId } from "@/ui";

/**
 * Drop-in for server-rendered pages: declares the music this screen wants
 * while it is mounted (see useMusicScene). Renders nothing.
 */
export function MusicScene({ track }: { track: TrackId }) {
  useMusicScene(track);
  return null;
}

/** The music for a world, by its authored theme string. */
export function WorldMusic({ theme }: { theme: string }) {
  useMusicScene(trackForTheme(theme));
  return null;
}

/**
 * Read `text` aloud once when it first appears (and again whenever it
 * changes) — only if the child has narration on. Used for briefings, hints
 * and feedback, which are exactly the things a young reader most needs
 * heard. Stops speaking when the text goes away.
 */
export function useNarrateOnShow(text: string | null | undefined, enabled = true): void {
  const { narrate, stopNarration, prefs } = useSound();
  const spoken = useRef<string | null>(null);
  const voiceOn = prefs.voice.on && !prefs.muted;
  useEffect(() => {
    // The text went away (a panel closed, a card dismissed): stop talking,
    // and forget it, so the same text reopened is read again.
    if (!text || !text.trim()) {
      if (spoken.current !== null) {
        spoken.current = null;
        stopNarration();
      }
      return;
    }
    if (!enabled || !voiceOn) return;
    if (spoken.current === text) return;
    spoken.current = text;
    narrate(text);
  }, [text, enabled, voiceOn, narrate, stopNarration]);
  useEffect(() => () => stopNarration(), [stopNarration]);
}
