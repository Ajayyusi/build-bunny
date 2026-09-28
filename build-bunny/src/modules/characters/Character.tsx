"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useTranslations } from "next-intl";

import { BunnyMascot, cn, useReducedMotion, type BunnyState } from "@/ui";
import { ReadAloudButton } from "@/modules/audio/AudioControls";

import { CAST, lineKey, type CharacterId } from "./cast";
import { CharacterArt } from "./CharacterArt";
import { animationMs, reactTo, type CharacterEvent, type CharacterState } from "./states";
import styles from "./characters.module.css";

/** Robo Bunny already has a richer pose set; each character state maps onto one. */
const BUNNY_POSE: Record<CharacterState, BunnyState> = {
  idle: "idle",
  listening: "excited",
  thinking: "thinking",
  error: "confused",
  hint: "pointing",
  celebration: "celebrating",
};

const SIZES = { sm: "size-12", md: "size-20", lg: "size-28" } as const;

/**
 * One character in one state. Decorative (aria-hidden): what a character
 * SAYS is always real text beside it (CharacterLine), so nothing depends on
 * seeing the art or its motion. Under reduced motion it holds still and the
 * state's expression is the static fallback.
 */
export function Character({
  id,
  state = "idle",
  size = "md",
  face = "end",
  className,
}: {
  id: CharacterId;
  state?: CharacterState;
  size?: keyof typeof SIZES;
  /** Which side the relevant object is on (the hint gesture points there). */
  face?: "start" | "end";
  className?: string;
}) {
  const reduced = useReducedMotion();
  const image = CAST[id].art[state];
  if (id === "bunny" && !image) {
    return <BunnyMascot state={BUNNY_POSE[state]} size={size === "lg" ? "lg" : size === "sm" ? "sm" : "md"} className={className} />;
  }
  return (
    <span
      aria-hidden="true"
      data-character={id}
      data-state={state}
      data-face={face}
      data-still={reduced ? "" : undefined}
      style={{ "--ch-ms": `${animationMs(state)}ms` } as CSSProperties}
      className={cn(styles.character, SIZES[size], className)}
    >
      {image ? (
        // Production art for this state (transparent WebP/PNG); the
        // placeholder covers any state that has none yet.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" className="h-full w-full object-contain" />
      ) : (
        <CharacterArt id={id as Exclude<CharacterId, "bunny">} state={state} />
      )}
    </span>
  );
}

/**
 * A character's state driven by what just happened: react(event) shows the
 * reaction and settles back to idle after the spec's hold time. Feedback
 * follows a choice; nothing loops except the subtle idle.
 */
export function useCharacterReaction(initial: CharacterState = "idle") {
  const [state, setState] = useState<CharacterState>(initial);
  const timer = useRef<number | null>(null);
  const react = useCallback((event: CharacterEvent) => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    const { state: next, holdMs } = reactTo(event);
    setState(next);
    timer.current = holdMs === null ? null : window.setTimeout(() => setState("idle"), holdMs);
  }, []);
  useEffect(() => () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
  }, []);
  return [state, react] as const;
}

/**
 * A character saying one of its own short lines, as real text with the
 * usual read-aloud button (audio supports reading; it is never required).
 */
export function CharacterLine({
  id,
  line,
  values,
  state = "idle",
  face,
  children,
  className,
}: {
  id: CharacterId;
  /** One of CAST[id].lines. */
  line: string;
  values?: Record<string, string | number>;
  state?: CharacterState;
  face?: "start" | "end";
  /** Anything the moment adds under the line (a button, a choice). */
  children?: ReactNode;
  className?: string;
}) {
  const t = useTranslations("characters");
  const text = t(lineKey(id, line), values);
  return (
    <div
      data-character-line={id}
      className={cn("flex items-end gap-2", className)}
      style={{ "--ch-accent": CAST[id].accent } as CSSProperties}
    >
      <Character id={id} state={state} size="sm" face={face} />
      <div className={cn(styles.bubble, "flex min-w-0 flex-1 flex-col gap-1.5")}>
        <p className="flex items-start gap-2 text-sm text-ink">
          <span className="min-w-0 flex-1">
            <span className="font-display font-bold">{t(`${id}.name`)}: </span>
            {text}
          </span>
          <ReadAloudButton text={text} />
        </p>
        {children}
      </div>
    </div>
  );
}
